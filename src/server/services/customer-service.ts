import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/db/client';
import { AppError } from '@/lib/errors';
import { normalisePhone } from '@/lib/phone';
import { assertPermission, type StoreContext } from '@/server/policies/context';

import { recordAudit } from './audit-service';

/**
 * Customers.
 *
 * A customer record is created automatically with their first order; this
 * service is the read and annotation side. Phone is the identity key, always in
 * canonical form, which is what makes duplicate detection and history work.
 */

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  isBlocked: boolean;
  tags: string[];
  createdAt: Date;
}

export interface CustomerFilter {
  search?: string;
  blocked?: boolean;
  sort: 'newest' | 'spent' | 'orders';
  page: number;
  perPage: number;
}

export async function listCustomers(context: StoreContext, filter: CustomerFilter) {
  assertPermission(context, 'customers.view');

  const where: Prisma.CustomerWhereInput = { storeId: context.storeId };

  if (filter.search) {
    const phone = normalisePhone(filter.search, context.country);
    where.OR = [
      { name: { contains: filter.search, mode: 'insensitive' } },
      { phone: { contains: phone.canonical || filter.search } },
      { email: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  if (filter.blocked !== undefined) where.isBlocked = filter.blocked;

  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    filter.sort === 'spent'
      ? { totalSpent: 'desc' }
      : filter.sort === 'orders'
        ? { ordersCount: 'desc' }
        : { createdAt: 'desc' };

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy,
      skip: (filter.page - 1) * filter.perPage,
      take: filter.perPage,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        ordersCount: true,
        totalSpent: true,
        lastOrderAt: true,
        isBlocked: true,
        tags: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    items,
    total,
    page: filter.page,
    perPage: filter.perPage,
    pageCount: Math.max(1, Math.ceil(total / filter.perPage)),
  };
}

export async function getCustomer(context: StoreContext, customerId: string) {
  assertPermission(context, 'customers.view');

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId: context.storeId },
    include: {
      addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!customer) throw new AppError('NOT_FOUND', 'Customer not found.');
  return customer;
}

export async function updateCustomerNotes(
  context: StoreContext,
  customerId: string,
  input: { notes: string | null; tags: string[] },
): Promise<void> {
  assertPermission(context, 'customers.edit');

  const result = await prisma.customer.updateMany({
    where: { id: customerId, storeId: context.storeId },
    data: { notes: input.notes, tags: input.tags },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Customer not found.');
}

/**
 * Block a customer.
 *
 * Enforced server-side at order creation: a blocked phone cannot place a new
 * order, regardless of what the storefront shows.
 */
export async function setCustomerBlocked(
  context: StoreContext,
  customerId: string,
  isBlocked: boolean,
): Promise<void> {
  assertPermission(context, 'customers.edit');

  const result = await prisma.customer.updateMany({
    where: { id: customerId, storeId: context.storeId },
    data: { isBlocked },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Customer not found.');

  await recordAudit(context, {
    action: 'SETTINGS_UPDATED',
    entityType: 'customer',
    entityId: customerId,
    after: { isBlocked },
  });
}

/**
 * Count recent orders from a phone, for duplicate-order protection.
 * Compares canonical phones — raw string equality would miss 091-234-5678
 * against +218912345678.
 */
export async function countRecentOrders(
  storeId: string,
  canonicalPhone: string,
  windowHours: number,
): Promise<number> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  return prisma.order.count({
    where: {
      storeId,
      customerPhone: canonicalPhone,
      createdAt: { gte: since },
      status: { not: 'CANCELLED' },
    },
  });
}
