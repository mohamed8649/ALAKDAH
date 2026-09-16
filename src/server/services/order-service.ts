import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma, type DbClient } from '@/db/client';
import { effectivePrice, applyOffers, type CampaignInput } from '@/features/campaigns/pricing';
import {
  canTransition,
  requiresReason,
  RESTOCKING_STATUSES,
  shippingStatusFor,
  timestampFieldFor,
  type OrderStatus,
} from '@/features/orders/state-machine';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { normalisePhone } from '@/lib/phone';
import { generateOrderNumber } from '@/lib/slug';
import { resolveDateRange } from '@/lib/datetime';
import { emit } from '@/server/events';
import { assertPermission, hasPermission, type StoreContext } from '@/server/policies/context';
import type {
  BulkOrderActionInput,
  ManualOrderInput,
  OrderFilter,
  OrderStatusChangeInput,
  OrderUpdateInput,
} from '@/validators/order';

import { recordAudit } from './audit-service';
import { assertWithinLimit } from './billing-service';
import { applyStockChange } from './inventory-service';
import { resolveAgentForOrder } from './agent-service';
import { resolveProviderForOrder } from './shipping-service';

/**
 * Order service.
 *
 * The centre of the platform. Two rules hold everywhere in this file:
 *
 *  1. Order creation is transactional. Items, totals, inventory and the initial
 *     history row commit together or not at all. Side effects (pixels,
 *     notifications) fire only after the commit.
 *  2. Status never changes by assignment. Every change goes through
 *     `changeStatus`, which consults the state machine, records history, and
 *     applies the consequences (restock, timestamps, shipping status).
 */

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  shippingStatus: string;
  source: string;
  customerName: string;
  customerPhone: string;
  state: string;
  city: string;
  total: number;
  itemCount: number;
  riskFlagged: boolean;
  agentName: string | null;
  providerName: string | null;
  createdAt: Date;
}

export interface OrderListResult {
  items: OrderListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export async function listOrders(
  context: StoreContext,
  filter: OrderFilter,
): Promise<OrderListResult> {
  assertPermission(context, 'orders.view');

  const where = buildOrderWhere(context, filter);
  const skip = (filter.page - 1) * filter.perPage;

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: orderOrderBy(filter.sort),
      skip,
      take: filter.perPage,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        shippingStatus: true,
        source: true,
        customerName: true,
        customerPhone: true,
        state: true,
        city: true,
        total: true,
        riskFlagged: true,
        createdAt: true,
        assignedAgent: { select: { fullName: true } },
        shippingProvider: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status as OrderStatus,
      paymentStatus: row.paymentStatus,
      shippingStatus: row.shippingStatus,
      source: row.source,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      state: row.state,
      city: row.city,
      total: row.total,
      itemCount: row._count.items,
      riskFlagged: row.riskFlagged,
      agentName: row.assignedAgent?.fullName ?? null,
      providerName: row.shippingProvider?.name ?? null,
      createdAt: row.createdAt,
    })),
    total,
    page: filter.page,
    perPage: filter.perPage,
    pageCount: Math.max(1, Math.ceil(total / filter.perPage)),
  };
}

/**
 * Build the WHERE clause.
 *
 * A call-center agent sees only their own orders. That restriction is applied
 * here, not in the page, so every read path inherits it — including export.
 */
export function buildOrderWhere(context: StoreContext, filter: OrderFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { storeId: context.storeId };

  if (context.actor.type === 'AGENT') {
    where.assignedAgentId = context.actor.id;
  } else if (filter.agentId) {
    where.assignedAgentId = filter.agentId === 'none' ? null : filter.agentId;
  }

  if (filter.status) where.status = filter.status;
  if (filter.paymentStatus) where.paymentStatus = filter.paymentStatus;
  if (filter.shippingStatus) where.shippingStatus = filter.shippingStatus;
  if (filter.source) where.source = filter.source;
  if (filter.flagged === '1') where.riskFlagged = true;
  if (filter.providerId) {
    where.shippingProviderId = filter.providerId === 'none' ? null : filter.providerId;
  }
  if (filter.productId) where.items = { some: { productId: filter.productId } };

  if (filter.search) {
    const search = filter.search.trim();
    const phone = normalisePhone(search, context.country);
    where.OR = [
      { orderNumber: { contains: search.toUpperCase() } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { customerPhone: { contains: phone.canonical || search } },
    ];
  }

  if (filter.from || filter.to) {
    const range = resolveDateRange('custom', context.timezone, {
      from: filter.from,
      to: filter.to,
    });
    where.createdAt = { gte: range.from, lte: range.to };
  }

  return where;
}

function orderOrderBy(sort: OrderFilter['sort']): Prisma.OrderOrderByWithRelationInput {
  switch (sort) {
    case 'oldest':
      return { createdAt: 'asc' };
    case 'total_desc':
      return { total: 'desc' };
    case 'total_asc':
      return { total: 'asc' };
    default:
      return { createdAt: 'desc' };
  }
}

const ORDER_DETAIL_INCLUDE = {
  items: true,
  history: { orderBy: { createdAt: 'asc' } },
  customer: { select: { id: true, name: true, phone: true, ordersCount: true, totalSpent: true } },
  assignedAgent: { select: { id: true, fullName: true, username: true } },
  shippingProvider: { select: { id: true, name: true, providerKey: true } },
  shippingMethod: { select: { id: true, name: true, type: true } },
  campaign: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

export async function getOrder(context: StoreContext, orderId: string): Promise<OrderDetail> {
  assertPermission(context, 'orders.view');

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      storeId: context.storeId,
      ...(context.actor.type === 'AGENT' ? { assignedAgentId: context.actor.id } : {}),
    },
    include: ORDER_DETAIL_INCLUDE,
  });

  if (!order) throw new AppError('NOT_FOUND', 'Order not found.');
  return order;
}

// ---------------------------------------------------------------------------
// Creating
// ---------------------------------------------------------------------------

export interface ResolvedLine {
  productId: string;
  variantId: string | null;
  nameSnapshot: string;
  skuSnapshot: string | null;
  variantSnapshot: string | null;
  imageSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface CreateOrderData {
  source: 'STOREFRONT' | 'LANDING_PAGE' | 'MANUAL' | 'CALL_CENTER' | 'IMPORT' | 'API';
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  state: string;
  city: string;
  address: string;
  notes?: string | null;
  internalNotes?: string | null;
  lines: ResolvedLine[];
  shippingAmount: number;
  discountAmount: number;
  shippingMethodId?: string | null;
  assignedAgentId?: string | null;
  campaignId?: string | null;
  landingPageId?: string | null;
  ipAddress?: string | null;
  riskFlagged?: boolean;
  riskReason?: string | null;
  customFields?: Record<string, unknown> | null;
  actor: { type: 'USER' | 'AGENT' | 'SYSTEM' | 'CUSTOMER' | 'API'; id?: string | null; name?: string | null };
}

/**
 * Resolve cart lines against the live catalogue.
 *
 * Prices always come from the database, adjusted by any running campaign. A
 * price submitted by the browser is only honoured for a manual order created by
 * a staff member with the permission to do so — a storefront checkout can never
 * name its own price.
 */
export async function resolveOrderLines(
  db: DbClient,
  storeId: string,
  requested: ReadonlyArray<{ productId: string; variantId?: string | null; quantity: number; unitPrice?: number | null }>,
  options?: { allowPriceOverride?: boolean; now?: Date },
): Promise<ResolvedLine[]> {
  if (requested.length === 0) throw new AppError('CART_EMPTY', 'No items in the order.');

  const now = options?.now ?? new Date();
  const productIds = [...new Set(requested.map((line) => line.productId))];

  const products = await db.product.findMany({
    where: { id: { in: productIds }, storeId, archivedAt: null },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      compareAtPrice: true,
      status: true,
      visibility: true,
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      variants: { select: { id: true, title: true, sku: true, price: true, isActive: true } },
      offers: true,
    },
  });

  const campaigns = await loadRunningCampaigns(db, storeId, now);
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: ResolvedLine[] = [];

  for (const request of requested) {
    const product = byId.get(request.productId);
    if (!product) {
      throw new AppError('PRODUCT_UNAVAILABLE', 'A product in this order no longer exists.');
    }
    if (product.status !== 'ACTIVE') {
      throw new AppError('PRODUCT_UNAVAILABLE', `${product.name} is not available.`);
    }

    const variant = request.variantId
      ? product.variants.find((candidate) => candidate.id === request.variantId)
      : null;

    if (request.variantId && !variant) {
      throw new AppError('PRODUCT_UNAVAILABLE', 'The selected variant no longer exists.');
    }
    if (variant && !variant.isActive) {
      throw new AppError('PRODUCT_UNAVAILABLE', `${variant.title} is not available.`);
    }

    const catalogueBase = variant?.price ?? product.price;
    const priced = effectivePrice(
      { id: product.id, price: catalogueBase, compareAtPrice: product.compareAtPrice },
      campaigns,
      now,
    );

    const unitPrice =
      options?.allowPriceOverride && request.unitPrice != null ? request.unitPrice : priced.price;

    const offerResult = applyOffers(unitPrice, request.quantity, product.offers);

    lines.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      nameSnapshot: product.name,
      skuSnapshot: variant?.sku ?? product.sku,
      variantSnapshot: variant?.title ?? null,
      imageSnapshot: product.images[0]?.url ?? null,
      unitPrice,
      quantity: request.quantity,
      total: offerResult.lineTotal,
    });
  }

  return lines;
}

async function loadRunningCampaigns(
  db: DbClient,
  storeId: string,
  now: Date,
): Promise<CampaignInput[]> {
  const rows = await db.campaign.findMany({
    where: {
      storeId,
      isActive: true,
      archivedAt: null,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    include: { products: { select: { productId: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    discountPercent: row.discountPercent,
    startAt: row.startAt,
    endAt: row.endAt,
    isActive: row.isActive,
    appliesToAll: row.appliesToAll,
    productIds: row.products.map((link) => link.productId),
  }));
}

/**
 * Create an order.
 *
 * Called by the storefront checkout, the manual-order form, the agent portal
 * and imports. Everything inside the transaction is required for a correct
 * order; everything after it is a consequence that must not be able to fail the
 * order.
 */
export async function createOrder(
  storeId: string,
  data: CreateOrderData,
  currency: string,
  country: string,
): Promise<{ id: string; orderNumber: string; total: number }> {
  await assertWithinLimit(storeId, 'orders');

  const phone = normalisePhone(data.customerPhone, country);
  const subtotal = data.lines.reduce((sum, line) => sum + line.total, 0);
  const total = Math.max(0, subtotal - data.discountAmount + data.shippingAmount);

  const created = await prisma.$transaction(async (tx) => {
    const customer = await upsertCustomer(tx, storeId, {
      name: data.customerName,
      phone: phone.canonical,
      phoneRaw: data.customerPhone,
      email: data.customerEmail ?? null,
      state: data.state,
      city: data.city,
      address: data.address,
    });

    const orderNumber = await allocateOrderNumber(tx, storeId);

    const agentId =
      data.assignedAgentId ??
      (await resolveAgentForOrder(tx, storeId, data.lines.map((line) => line.productId)));

    const order = await tx.order.create({
      data: {
        storeId,
        orderNumber,
        customerId: customer.id,
        status: 'NEW',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
        shippingStatus: 'NOT_SHIPPED',
        subtotal,
        discountAmount: data.discountAmount,
        shippingAmount: data.shippingAmount,
        total,
        currency,
        source: data.source,
        assignedAgentId: agentId,
        shippingMethodId: data.shippingMethodId ?? null,
        campaignId: data.campaignId ?? null,
        landingPageId: data.landingPageId ?? null,
        customerName: data.customerName,
        customerPhone: phone.canonical,
        customerPhoneRaw: data.customerPhone,
        customerEmail: data.customerEmail || null,
        state: data.state,
        city: data.city,
        address: data.address,
        notes: data.notes ?? null,
        internalNotes: data.internalNotes ?? null,
        ipAddress: data.ipAddress ?? null,
        riskFlagged: data.riskFlagged ?? false,
        riskReason: data.riskReason ?? null,
        customFields: data.customFields
          ? (JSON.parse(JSON.stringify(data.customFields)) as object)
          : undefined,
        items: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            nameSnapshot: line.nameSnapshot,
            skuSnapshot: line.skuSnapshot,
            variantSnapshot: line.variantSnapshot,
            imageSnapshot: line.imageSnapshot,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            total: line.total,
          })),
        },
        history: {
          create: {
            fromStatus: null,
            toStatus: 'NEW',
            actorType: data.actor.type,
            actorId: data.actor.id ?? null,
            actorName: data.actor.name ?? null,
            reason: null,
          },
        },
      },
      select: { id: true, orderNumber: true, total: true },
    });

    // Reserve stock as part of the same transaction. A stock failure here rolls
    // the whole order back rather than creating an order that cannot be filled.
    for (const line of data.lines) {
      await applyStockChange(
        tx,
        storeId,
        {
          productId: line.productId,
          variantId: line.variantId,
          delta: -line.quantity,
          reason: 'ORDER_PLACED',
          reference: order.orderNumber,
        },
        data.actor.id ?? null,
      );
    }

    await tx.customer.update({
      where: { id: customer.id },
      data: {
        ordersCount: { increment: 1 },
        totalSpent: { increment: total },
        lastOrderAt: new Date(),
      },
    });

    // Carrier assignment is advisory: a store with no matching rule still gets
    // a valid order, just without a carrier.
    const providerId = await resolveProviderForOrder(tx, storeId, {
      state: data.state,
      city: data.city,
      total,
      methodType: null,
    });
    if (providerId) {
      await tx.order.update({ where: { id: order.id }, data: { shippingProviderId: providerId } });
    }

    return order;
  });

  await emit({
    name: 'order_created',
    storeId,
    orderId: created.id,
    value: created.total,
    payload: { orderNumber: created.orderNumber, source: data.source },
  });

  await notifyNewOrder(storeId, created.id, created.orderNumber, created.total);

  return created;
}

/**
 * Allocate a unique order number.
 *
 * Randomly generated rather than sequential so the tracking page cannot be
 * walked by incrementing a number. Collisions are retried; the alphabet
 * excludes characters that are misread over the phone.
 */
async function allocateOrderNumber(tx: DbClient, storeId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateOrderNumber(attempt < 5 ? 6 : 8);
    const existing = await tx.order.findFirst({
      where: { storeId, orderNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new AppError('INTERNAL_ERROR', 'Could not allocate an order number.');
}

async function upsertCustomer(
  tx: DbClient,
  storeId: string,
  input: {
    name: string;
    phone: string;
    phoneRaw: string;
    email: string | null;
    state: string;
    city: string;
    address: string;
  },
) {
  const existing = await tx.customer.findFirst({
    where: { storeId, phone: input.phone },
    select: { id: true, isBlocked: true },
  });

  if (existing) {
    if (existing.isBlocked) {
      throw new AppError('FORBIDDEN', 'This customer is blocked.');
    }
    if (input.address) {
      const address = await tx.customerAddress.findFirst({
        where: { customerId: existing.id, address: input.address, city: input.city },
        select: { id: true },
      });
      if (!address) {
        await tx.customerAddress.create({
          data: {
            customerId: existing.id,
            state: input.state,
            city: input.city,
            address: input.address,
          },
        });
      }
    }
    return existing;
  }

  return tx.customer.create({
    data: {
      storeId,
      name: input.name,
      phone: input.phone,
      phoneRaw: input.phoneRaw,
      email: input.email,
      addresses: input.address
        ? {
            create: {
              state: input.state,
              city: input.city,
              address: input.address,
              isDefault: true,
            },
          }
        : undefined,
    },
    select: { id: true, isBlocked: true },
  });
}

/** Manual order created by staff from the dashboard. */
export async function createManualOrder(
  context: StoreContext,
  input: ManualOrderInput,
): Promise<{ id: string; orderNumber: string }> {
  assertPermission(context, 'orders.create');

  const lines = await resolveOrderLines(prisma, context.storeId, input.items, {
    allowPriceOverride: hasPermission(context, 'orders.edit'),
  });

  const order = await createOrder(
    context.storeId,
    {
      source: context.actor.type === 'AGENT' ? 'CALL_CENTER' : 'MANUAL',
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail || null,
      state: input.state,
      city: input.city,
      address: input.address,
      notes: input.notes ?? null,
      internalNotes: input.internalNotes ?? null,
      lines,
      shippingAmount: input.shippingAmount ?? 0,
      discountAmount: input.discountAmount ?? 0,
      shippingMethodId: input.shippingMethodId ?? null,
      assignedAgentId: input.assignedAgentId ?? null,
      actor: { type: context.actor.type, id: context.actor.id, name: context.actor.name },
    },
    context.currency,
    context.country,
  );

  await recordAudit(context, {
    action: 'ORDER_CREATED',
    entityType: 'order',
    entityId: order.id,
    after: { orderNumber: order.orderNumber, total: order.total, source: 'MANUAL' },
  });

  return order;
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

/**
 * Change an order's status.
 *
 * Idempotent by construction: the update is guarded on the current status, so a
 * double-click issues two requests and only the first one changes anything.
 * The second finds the order already in the target state and returns quietly
 * instead of writing a second history row.
 */
export async function changeOrderStatus(
  context: StoreContext,
  input: OrderStatusChangeInput,
): Promise<{ status: OrderStatus; alreadyApplied: boolean }> {
  assertPermission(context, 'orders.change_status');

  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      storeId: context.storeId,
      ...(context.actor.type === 'AGENT' ? { assignedAgentId: context.actor.id } : {}),
    },
    select: { id: true, status: true, version: true, orderNumber: true, total: true },
  });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found.');

  const from = order.status as OrderStatus;

  if (from === input.toStatus) {
    return { status: from, alreadyApplied: true };
  }

  if (!canTransition(from, input.toStatus)) {
    throw new AppError('ORDER_INVALID_TRANSITION', `Cannot move from ${from} to ${input.toStatus}.`, {
      meta: { from, to: input.toStatus },
    });
  }

  if (requiresReason(input.toStatus) && !input.reason?.trim()) {
    throw new AppError('VALIDATION_FAILED', 'A reason is required for this status change.', {
      fieldErrors: { reason: ['validation.required'] },
    });
  }

  if (input.expectedVersion != null && input.expectedVersion !== order.version) {
    throw new AppError('STALE_DATA', 'This order was modified by someone else.', {
      meta: { expected: input.expectedVersion, actual: order.version },
    });
  }

  await prisma.$transaction(async (tx) => {
    const timestampField = timestampFieldFor(input.toStatus);

    const result = await tx.order.updateMany({
      // Guarding on the current status is what makes this idempotent under
      // concurrent submissions.
      where: { id: order.id, storeId: context.storeId, status: from },
      data: {
        status: input.toStatus,
        shippingStatus: shippingStatusFor(input.toStatus),
        version: { increment: 1 },
        cancelReason: input.toStatus === 'CANCELLED' ? (input.reason ?? null) : undefined,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
        ...(input.toStatus === 'DELIVERED' ? { paymentStatus: 'PAID' as const } : {}),
      },
    });

    if (result.count === 0) {
      throw new AppError('STALE_DATA', 'This order was modified by someone else.');
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: from,
        toStatus: input.toStatus,
        actorType: context.actor.type,
        actorId: context.actor.id,
        actorName: context.actor.name,
        reason: input.reason ?? null,
      },
    });

    if (RESTOCKING_STATUSES.includes(input.toStatus) && !RESTOCKING_STATUSES.includes(from)) {
      await restockOrder(tx, context.storeId, order.id, input.toStatus);
    }

    if (input.toStatus === 'CANCELLED') {
      await tx.customer.updateMany({
        where: { orders: { some: { id: order.id } } },
        data: { totalSpent: { decrement: order.total } },
      });
    }

    await recordAudit(
      context,
      {
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'order',
        entityId: order.id,
        before: { status: from },
        after: { status: input.toStatus },
        metadata: { reason: input.reason ?? undefined, orderNumber: order.orderNumber },
      },
      tx,
    );
  });

  const eventName = statusEventName(input.toStatus);
  if (eventName) {
    await emit({
      name: eventName,
      storeId: context.storeId,
      orderId: order.id,
      value: order.total,
      payload: { orderNumber: order.orderNumber, from, to: input.toStatus },
    });
  }

  return { status: input.toStatus, alreadyApplied: false };
}

function statusEventName(status: OrderStatus) {
  switch (status) {
    case 'CONFIRMED':
      return 'order_confirmed' as const;
    case 'SHIPPED':
      return 'order_shipped' as const;
    case 'DELIVERED':
      return 'order_delivered' as const;
    default:
      return null;
  }
}

async function restockOrder(
  tx: DbClient,
  storeId: string,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, variantId: true, quantity: true },
  });

  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { orderNumber: true },
  });

  for (const item of items) {
    if (!item.productId) continue;
    await applyStockChange(tx, storeId, {
      productId: item.productId,
      variantId: item.variantId,
      delta: item.quantity,
      reason: status === 'RETURNED' ? 'ORDER_RETURNED' : 'ORDER_CANCELLED',
      reference: order.orderNumber,
    });
  }
}

// ---------------------------------------------------------------------------
// Updating & bulk actions
// ---------------------------------------------------------------------------

export async function updateOrder(
  context: StoreContext,
  input: OrderUpdateInput,
): Promise<void> {
  assertPermission(context, 'orders.edit');

  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      storeId: context.storeId,
      ...(context.actor.type === 'AGENT' ? { assignedAgentId: context.actor.id } : {}),
    },
    select: {
      id: true,
      version: true,
      customerName: true,
      customerPhone: true,
      state: true,
      city: true,
      address: true,
      assignedAgentId: true,
      shippingProviderId: true,
    },
  });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found.');

  if (input.expectedVersion != null && input.expectedVersion !== order.version) {
    throw new AppError('STALE_DATA', 'This order was modified by someone else.');
  }

  if (input.assignedAgentId) {
    assertPermission(context, 'orders.assign');
    const agent = await prisma.agent.findFirst({
      where: { id: input.assignedAgentId, storeId: context.storeId, archivedAt: null },
      select: { id: true },
    });
    if (!agent) throw new AppError('NOT_FOUND', 'Agent not found.');
  }

  if (input.shippingProviderId) {
    const provider = await prisma.shippingProvider.findFirst({
      where: { id: input.shippingProviderId, storeId: context.storeId, archivedAt: null },
      select: { id: true },
    });
    if (!provider) throw new AppError('NOT_FOUND', 'Carrier not found.');
  }

  const phone = input.customerPhone
    ? normalisePhone(input.customerPhone, context.country)
    : null;

  const result = await prisma.order.updateMany({
    where: { id: order.id, storeId: context.storeId, version: order.version },
    data: {
      customerName: input.customerName,
      customerPhone: phone?.canonical,
      customerPhoneRaw: input.customerPhone,
      state: input.state,
      city: input.city,
      address: input.address,
      internalNotes: input.internalNotes,
      tags: input.tags,
      assignedAgentId: input.assignedAgentId,
      shippingProviderId: input.shippingProviderId,
      trackingNumber: input.trackingNumber,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    throw new AppError('STALE_DATA', 'This order was modified by someone else.');
  }

  await recordAudit(context, {
    action: 'ORDER_UPDATED',
    entityType: 'order',
    entityId: order.id,
    before: {
      customerName: order.customerName,
      city: order.city,
      assignedAgentId: order.assignedAgentId,
      shippingProviderId: order.shippingProviderId,
    },
    after: {
      customerName: input.customerName,
      city: input.city,
      assignedAgentId: input.assignedAgentId,
      shippingProviderId: input.shippingProviderId,
    },
  });
}

export interface BulkResult {
  total: number;
  succeeded: number;
  failed: Array<{ orderId: string; code: string }>;
}

/**
 * Apply an action to many orders.
 *
 * Each order is processed independently so one invalid transition does not
 * abort the batch. The caller is told exactly how many succeeded — a partial
 * result is reported as a partial result, never as success.
 */
export async function bulkOrderAction(
  context: StoreContext,
  input: BulkOrderActionInput,
): Promise<BulkResult> {
  assertPermission(context, 'orders.change_status');

  const failed: BulkResult['failed'] = [];
  let succeeded = 0;

  for (const orderId of input.orderIds) {
    try {
      if (input.action === 'change_status' && input.toStatus) {
        await changeOrderStatus(context, {
          orderId,
          toStatus: input.toStatus,
          reason: input.reason ?? null,
        });
      } else if (input.action === 'assign_agent') {
        await updateOrder(context, { orderId, assignedAgentId: input.agentId ?? null });
      } else if (input.action === 'assign_provider') {
        await updateOrder(context, { orderId, shippingProviderId: input.providerId ?? null });
      } else {
        throw new AppError('VALIDATION_FAILED', 'Unsupported bulk action.');
      }
      succeeded += 1;
    } catch (error) {
      failed.push({
        orderId,
        code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      });
    }
  }

  return { total: input.orderIds.length, succeeded, failed };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportResult {
  csv: string;
  rowCount: number;
  filename: string;
}

/**
 * Export the orders matching the current filters.
 *
 * Honours the filters, the date range and the caller's permissions — an agent
 * exports only their own orders. An empty result is reported as empty rather
 * than downloading a file with nothing in it.
 */
export async function exportOrders(
  context: StoreContext,
  filter: OrderFilter,
): Promise<ExportResult> {
  assertPermission(context, 'orders.export');

  const where = buildOrderWhere(context, filter);
  const rows = await prisma.order.findMany({
    where,
    orderBy: orderOrderBy(filter.sort),
    take: 5000,
    include: {
      items: { select: { nameSnapshot: true, variantSnapshot: true, quantity: true } },
      assignedAgent: { select: { fullName: true } },
      shippingProvider: { select: { name: true } },
    },
  });

  if (rows.length === 0) {
    return { csv: '', rowCount: 0, filename: '' };
  }

  const header = [
    'order_number', 'created_at', 'status', 'payment_status', 'shipping_status',
    'customer_name', 'phone', 'state', 'city', 'address',
    'items', 'subtotal', 'discount', 'shipping', 'total', 'currency',
    'source', 'agent', 'carrier', 'tracking_number', 'notes',
  ];

  const lines = [header.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.orderNumber,
        row.createdAt.toISOString(),
        row.status,
        row.paymentStatus,
        row.shippingStatus,
        row.customerName,
        row.customerPhone,
        row.state,
        row.city,
        row.address,
        row.items
          .map((item) => `${item.nameSnapshot}${item.variantSnapshot ? ` (${item.variantSnapshot})` : ''} x${item.quantity}`)
          .join(' | '),
        minorToDecimal(row.subtotal, row.currency),
        minorToDecimal(row.discountAmount, row.currency),
        minorToDecimal(row.shippingAmount, row.currency),
        minorToDecimal(row.total, row.currency),
        row.currency,
        row.source,
        row.assignedAgent?.fullName ?? '',
        row.shippingProvider?.name ?? '',
        row.trackingNumber ?? '',
        row.notes ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  await recordAudit(context, {
    action: 'ORDER_EXPORTED',
    entityType: 'order',
    metadata: { rowCount: rows.length, filters: filter as unknown as Record<string, unknown> },
  });

  return {
    // The BOM makes Excel open Arabic columns as UTF-8 instead of mojibake.
    csv: `﻿${lines.join('\r\n')}`,
    rowCount: rows.length,
    filename: `orders-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  // A cell starting with =, +, - or @ is executed as a formula by spreadsheet
  // software; prefixing a quote neutralises the injection.
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\r\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

function minorToDecimal(minor: number, currency: string): string {
  const digits = currency === 'LYD' || currency === 'TND' ? 3 : 2;
  const str = Math.abs(minor).toString().padStart(digits + 1, '0');
  const whole = str.slice(0, str.length - digits);
  const fraction = str.slice(str.length - digits);
  return `${minor < 0 ? '-' : ''}${whole}.${fraction}`;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function notifyNewOrder(
  storeId: string,
  orderId: string,
  orderNumber: string,
  total: number,
): Promise<void> {
  try {
    const settings = await prisma.storeSettings.findUnique({
      where: { storeId },
      select: { notificationsEnabled: true, notifyOnNewOrder: true },
    });
    if (settings && (!settings.notificationsEnabled || !settings.notifyOnNewOrder)) return;

    await prisma.notification.create({
      data: {
        storeId,
        type: 'order.created',
        titleAr: `طلب جديد ${orderNumber}`,
        bodyAr: null,
        link: `/dashboard/orders/${orderId}`,
        severity: 'info',
      },
    });
  } catch (error) {
    logger.error('notification write failed', error, { storeId, entityId: orderId });
  }
}
