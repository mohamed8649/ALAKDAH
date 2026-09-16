import 'server-only';

import { prisma, type DbClient } from '@/db/client';
import { AppError } from '@/lib/errors';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import type { InventoryAdjustment } from '@/validators/product';

import { recordAudit } from './audit-service';
import { recalculateProductStock } from './product-service';

/**
 * Inventory service.
 *
 * Stock is only ever changed here, always inside a transaction, and always with
 * a movement row recording why. Nothing computes a new balance in the browser
 * and writes it back — two concurrent orders would then both read 5, both write
 * 4, and one unit would be sold twice.
 */

export type StockReason =
  | 'MANUAL_ADJUSTMENT'
  | 'ORDER_PLACED'
  | 'ORDER_CANCELLED'
  | 'ORDER_RETURNED'
  | 'RESTOCK'
  | 'IMPORT'
  | 'CORRECTION';

export interface StockChange {
  productId: string;
  variantId?: string | null;
  /** Negative consumes stock, positive returns it. */
  delta: number;
  reason: StockReason;
  reference?: string | null;
  note?: string | null;
}

/**
 * Apply a relative stock change atomically.
 *
 * The decrement is issued as a conditional UPDATE so the database, not the
 * application, arbitrates the race. If the row no longer has enough stock the
 * update affects zero rows and we fail rather than going negative.
 */
export async function applyStockChange(
  tx: DbClient,
  storeId: string,
  change: StockChange,
  actorId?: string | null,
): Promise<void> {
  if (change.delta === 0) return;

  if (change.variantId) {
    await applyVariantChange(tx, storeId, change, actorId);
    await recalculateProductStock(tx, change.productId);
    return;
  }

  const product = await tx.product.findFirst({
    where: { id: change.productId, storeId },
    select: { id: true, trackInventory: true, allowBackorder: true, stockQuantity: true, name: true },
  });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.');
  if (!product.trackInventory) return;

  const consuming = change.delta < 0;
  const guard =
    consuming && !product.allowBackorder
      ? { stockQuantity: { gte: Math.abs(change.delta) } }
      : {};

  const result = await tx.product.updateMany({
    where: { id: change.productId, storeId, ...guard },
    data: { stockQuantity: { increment: change.delta } },
  });

  if (result.count === 0) {
    throw new AppError('INSUFFICIENT_STOCK', `Not enough stock for ${product.name}.`, {
      meta: { productId: change.productId, requested: Math.abs(change.delta), available: product.stockQuantity },
    });
  }

  const updated = await tx.product.findUniqueOrThrow({
    where: { id: change.productId },
    select: { stockQuantity: true },
  });

  await tx.inventoryMovement.create({
    data: {
      storeId,
      productId: change.productId,
      variantId: null,
      delta: change.delta,
      balance: updated.stockQuantity,
      reason: change.reason,
      reference: change.reference ?? null,
      note: change.note ?? null,
      actorId: actorId ?? null,
    },
  });
}

async function applyVariantChange(
  tx: DbClient,
  storeId: string,
  change: StockChange,
  actorId?: string | null,
): Promise<void> {
  const variant = await tx.productVariant.findFirst({
    where: { id: change.variantId!, product: { storeId, id: change.productId } },
    select: {
      id: true,
      title: true,
      stockQuantity: true,
      product: { select: { trackInventory: true, allowBackorder: true } },
    },
  });
  if (!variant) throw new AppError('NOT_FOUND', 'Variant not found.');
  if (!variant.product.trackInventory) return;

  const consuming = change.delta < 0;
  const guard =
    consuming && !variant.product.allowBackorder
      ? { stockQuantity: { gte: Math.abs(change.delta) } }
      : {};

  const result = await tx.productVariant.updateMany({
    where: { id: variant.id, ...guard },
    data: { stockQuantity: { increment: change.delta } },
  });

  if (result.count === 0) {
    throw new AppError('INSUFFICIENT_STOCK', `Not enough stock for ${variant.title}.`, {
      meta: { variantId: variant.id, requested: Math.abs(change.delta), available: variant.stockQuantity },
    });
  }

  const updated = await tx.productVariant.findUniqueOrThrow({
    where: { id: variant.id },
    select: { stockQuantity: true },
  });

  await tx.inventoryMovement.create({
    data: {
      storeId,
      productId: change.productId,
      variantId: variant.id,
      delta: change.delta,
      balance: updated.stockQuantity,
      reason: change.reason,
      reference: change.reference ?? null,
      note: change.note ?? null,
      actorId: actorId ?? null,
    },
  });
}

/** Merchant-facing absolute adjustment: "set this to 40". */
export async function adjustStock(
  context: StoreContext,
  input: InventoryAdjustment,
): Promise<{ newQuantity: number }> {
  assertPermission(context, 'inventory.manage');

  return prisma.$transaction(async (tx) => {
    const current = input.variantId
      ? await tx.productVariant.findFirst({
          where: { id: input.variantId, product: { storeId: context.storeId } },
          select: { stockQuantity: true, productId: true },
        })
      : await tx.product.findFirst({
          where: { id: input.productId, storeId: context.storeId },
          select: { stockQuantity: true },
        });

    if (!current) throw new AppError('NOT_FOUND', 'Item not found.');

    const delta = input.newQuantity - current.stockQuantity;
    if (delta !== 0) {
      await applyStockChange(
        tx,
        context.storeId,
        {
          productId: input.productId,
          variantId: input.variantId ?? null,
          delta,
          reason: input.reason,
          note: input.note ?? null,
        },
        context.actor.id,
      );
    }

    await recordAudit(
      context,
      {
        action: 'INVENTORY_ADJUSTED',
        entityType: input.variantId ? 'product_variant' : 'product',
        entityId: input.variantId ?? input.productId,
        before: { stockQuantity: current.stockQuantity },
        after: { stockQuantity: input.newQuantity },
        metadata: { reason: input.reason, note: input.note ?? undefined },
      },
      tx,
    );

    return { newQuantity: input.newQuantity };
  });
}

export async function listMovements(
  context: StoreContext,
  productId: string,
  limit = 50,
) {
  assertPermission(context, 'inventory.view');

  return prisma.inventoryMovement.findMany({
    where: { storeId: context.storeId, productId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { variant: { select: { title: true } } },
  });
}

export async function listLowStock(context: StoreContext, limit = 20) {
  assertPermission(context, 'inventory.view');

  const rows = await prisma.product.findMany({
    where: { storeId: context.storeId, archivedAt: null, trackInventory: true, status: 'ACTIVE' },
    orderBy: { stockQuantity: 'asc' },
    take: limit * 3,
    select: {
      id: true,
      name: true,
      stockQuantity: true,
      lowStockThreshold: true,
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
  });

  // The low-stock comparison is column-to-column, which the query layer cannot
  // express; the ordered pre-filter above keeps the post-filter cheap.
  return rows
    .filter((row) => row.stockQuantity <= row.lowStockThreshold)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      name: row.name,
      stockQuantity: row.stockQuantity,
      lowStockThreshold: row.lowStockThreshold,
      imageUrl: row.images[0]?.url ?? null,
    }));
}
