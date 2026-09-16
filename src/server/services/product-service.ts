import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma, type DbClient } from '@/db/client';
import {
  generateCombinations,
  reconcileVariants,
  suggestVariantSku,
  type OptionInput,
} from '@/features/products/variants';
import { AppError } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/lib/slug';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import type { ProductFilter, ProductInput } from '@/validators/product';

import { recordAudit } from './audit-service';
import { assertWithinLimit } from './billing-service';

/**
 * Product service.
 *
 * All catalogue writes funnel through here: permission check, tenant scoping,
 * slug uniqueness, variant reconciliation and audit, inside one transaction.
 * A React component never talks to Prisma.
 */

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  status: string;
  visibility: string;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  trackInventory: boolean;
  lowStockThreshold: number;
  allowBackorder: boolean;
  hasVariants: boolean;
  variantCount: number;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductListResult {
  items: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export async function listProducts(
  context: StoreContext,
  filter: ProductFilter,
): Promise<ProductListResult> {
  assertPermission(context, 'products.view');

  const where = buildProductWhere(context.storeId, filter);
  const skip = (filter.page - 1) * filter.perPage;

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: productOrderBy(filter.sort),
      skip,
      take: filter.perPage,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        status: true,
        visibility: true,
        price: true,
        compareAtPrice: true,
        stockQuantity: true,
        trackInventory: true,
        lowStockThreshold: true,
        allowBackorder: true,
        hasVariants: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { variants: true } },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
          orderBy: { position: 'asc' },
        },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      status: row.status,
      visibility: row.visibility,
      price: row.price,
      compareAtPrice: row.compareAtPrice,
      stockQuantity: row.stockQuantity,
      trackInventory: row.trackInventory,
      lowStockThreshold: row.lowStockThreshold,
      allowBackorder: row.allowBackorder,
      hasVariants: row.hasVariants,
      variantCount: row._count.variants,
      imageUrl: row.images[0]?.url ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    total,
    page: filter.page,
    perPage: filter.perPage,
    pageCount: Math.max(1, Math.ceil(total / filter.perPage)),
  };
}

function buildProductWhere(storeId: string, filter: ProductFilter): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { storeId, archivedAt: null };

  if (filter.status) where.status = filter.status;
  if (filter.categoryId) where.categories = { some: { categoryId: filter.categoryId } };
  if (filter.collectionId) where.collections = { some: { collectionId: filter.collectionId } };

  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search, mode: 'insensitive' } },
      { nameEn: { contains: filter.search, mode: 'insensitive' } },
      { sku: { contains: filter.search, mode: 'insensitive' } },
      { slug: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  if (filter.stock === 'OUT_OF_STOCK') {
    where.trackInventory = true;
    where.stockQuantity = { lte: 0 };
  } else if (filter.stock === 'IN_STOCK') {
    where.trackInventory = true;
    where.stockQuantity = { gt: 0 };
  } else if (filter.stock === 'LOW_STOCK') {
    // Low stock compares two columns, which Prisma cannot express in a filter;
    // the threshold is bounded so a fixed ceiling is a safe pre-filter and the
    // exact comparison happens in stockState() at render time.
    where.trackInventory = true;
    where.stockQuantity = { gt: 0, lte: 50 };
  }

  return where;
}

function productOrderBy(sort: ProductFilter['sort']): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case 'oldest':
      return { createdAt: 'asc' };
    case 'name':
      return { name: 'asc' };
    case 'price_asc':
      return { price: 'asc' };
    case 'price_desc':
      return { price: 'desc' };
    default:
      return { createdAt: 'desc' };
  }
}

const PRODUCT_DETAIL_INCLUDE = {
  images: { orderBy: { position: 'asc' } },
  options: {
    orderBy: { position: 'asc' },
    include: { values: { orderBy: { position: 'asc' } } },
  },
  variants: {
    orderBy: { position: 'asc' },
    include: { optionValues: true },
  },
  categories: { select: { categoryId: true } },
  collections: { select: { collectionId: true } },
  offers: { orderBy: { position: 'asc' } },
  relatedFrom: {
    orderBy: { position: 'asc' },
    include: {
      related: {
        select: {
          id: true,
          name: true,
          price: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type ProductDetail = Prisma.ProductGetPayload<{ include: typeof PRODUCT_DETAIL_INCLUDE }>;

export async function getProduct(context: StoreContext, productId: string): Promise<ProductDetail> {
  assertPermission(context, 'products.view');

  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: context.storeId },
    include: PRODUCT_DETAIL_INCLUDE,
  });

  if (!product) throw new AppError('NOT_FOUND', 'Product not found.');
  return product;
}

export async function createProduct(
  context: StoreContext,
  input: ProductInput,
): Promise<{ id: string; slug: string }> {
  assertPermission(context, 'products.create');
  await assertWithinLimit(context.storeId, 'products');

  const slug = await resolveSlug(context.storeId, input.slug, input.name, null);

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        storeId: context.storeId,
        ...scalarProductData(input),
        slug,
      },
      select: { id: true, slug: true },
    });

    await writeRelations(tx, context.storeId, created.id, input);
    await syncOptionsAndVariants(tx, created.id, input);
    await recalculateProductStock(tx, created.id);

    return created;
  });

  await recordAudit(context, {
    action: 'PRODUCT_CREATED',
    entityType: 'product',
    entityId: product.id,
    after: { name: input.name, price: input.price, status: input.status },
  });

  return product;
}

export async function updateProduct(
  context: StoreContext,
  productId: string,
  input: ProductInput,
): Promise<{ id: string; slug: string }> {
  assertPermission(context, 'products.edit');

  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId: context.storeId },
    select: { id: true, name: true, slug: true, price: true, status: true },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Product not found.');

  const slug = await resolveSlug(context.storeId, input.slug, input.name, productId);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.product.update({
      where: { id: productId },
      data: { ...scalarProductData(input), slug },
      select: { id: true, slug: true },
    });

    await clearRelations(tx, productId);
    await writeRelations(tx, context.storeId, productId, input);
    await syncOptionsAndVariants(tx, productId, input);
    await recalculateProductStock(tx, productId);

    return result;
  });

  await recordAudit(context, {
    action: 'PRODUCT_UPDATED',
    entityType: 'product',
    entityId: productId,
    before: { name: existing.name, price: existing.price, status: existing.status },
    after: { name: input.name, price: input.price, status: input.status },
  });

  return updated;
}

/**
 * Soft delete. A product referenced by historical orders is archived, never
 * removed: deleting it would break the order history it appears in.
 */
export async function archiveProduct(context: StoreContext, productId: string): Promise<void> {
  assertPermission(context, 'products.delete');

  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: context.storeId },
    select: { id: true, name: true },
  });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.');

  await prisma.product.update({
    where: { id: productId },
    data: { archivedAt: new Date(), status: 'ARCHIVED', visibility: 'HIDDEN' },
  });

  await recordAudit(context, {
    action: 'PRODUCT_DELETED',
    entityType: 'product',
    entityId: productId,
    before: { name: product.name },
  });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function scalarProductData(input: ProductInput) {
  return {
    name: input.name,
    nameEn: input.nameEn ?? null,
    sku: input.sku ?? null,
    description: input.description ?? null,
    shortDescription: input.shortDescription ?? null,
    status: input.status,
    visibility: input.visibility,
    price: input.price ?? 0,
    compareAtPrice: input.compareAtPrice ?? null,
    cost: input.cost ?? null,
    hasVariants: input.options.length > 0,
    trackInventory: input.trackInventory,
    lowStockThreshold: input.lowStockThreshold,
    allowBackorder: input.allowBackorder,
    weightGrams: input.weightGrams ?? null,
    shippingRequired: input.shippingRequired,
    freeShipping: input.freeShipping,
    upsellEnabled: input.upsellEnabled,
    upsellTitle: input.upsellTitle ?? null,
    upsellDescription: input.upsellDescription ?? null,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    tags: input.tags,
  };
}

async function resolveSlug(
  storeId: string,
  requested: string | undefined,
  name: string,
  excludeId: string | null,
): Promise<string> {
  const base = requested && requested.length > 0 ? requested : slugify(name, 'product');

  const conflicts = await prisma.product.findMany({
    where: {
      storeId,
      slug: { startsWith: base },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });

  return uniqueSlug(base, new Set(conflicts.map((row) => row.slug)));
}

async function clearRelations(tx: DbClient, productId: string): Promise<void> {
  await tx.productCategory.deleteMany({ where: { productId } });
  await tx.productCollection.deleteMany({ where: { productId } });
  await tx.relatedProduct.deleteMany({ where: { productId } });
  await tx.productOffer.deleteMany({ where: { productId } });
}

async function writeRelations(
  tx: DbClient,
  storeId: string,
  productId: string,
  input: ProductInput,
): Promise<void> {
  // Every related id is re-checked against the tenant. An id in the request
  // body proves nothing about who owns it.
  const [categories, collections, related] = await Promise.all([
    tx.category.findMany({ where: { storeId, id: { in: input.categoryIds } }, select: { id: true } }),
    tx.collection.findMany({ where: { storeId, id: { in: input.collectionIds } }, select: { id: true } }),
    tx.product.findMany({
      where: { storeId, id: { in: input.relatedProductIds.filter((id) => id !== productId) } },
      select: { id: true },
    }),
  ]);

  if (categories.length > 0) {
    await tx.productCategory.createMany({
      data: categories.map((category) => ({ productId, categoryId: category.id })),
      skipDuplicates: true,
    });
  }

  if (collections.length > 0) {
    await tx.productCollection.createMany({
      data: collections.map((collection) => ({ productId, collectionId: collection.id })),
      skipDuplicates: true,
    });
  }

  if (related.length > 0) {
    await tx.relatedProduct.createMany({
      data: related.map((row, index) => ({ productId, relatedId: row.id, position: index })),
      skipDuplicates: true,
    });
  }

  if (input.offers.length > 0) {
    await tx.productOffer.createMany({
      data: input.offers.map((offer, index) => ({
        productId,
        type: offer.type,
        title: offer.title,
        minQuantity: offer.minQuantity,
        discountPercent: offer.discountPercent ?? null,
        fixedPrice: offer.fixedPrice ?? null,
        isActive: offer.isActive,
        position: index,
      })),
    });
  }

  await syncImages(tx, productId, input);
}

async function syncImages(tx: DbClient, productId: string, input: ProductInput): Promise<void> {
  const existing = await tx.productImage.findMany({
    where: { productId },
    select: { id: true },
  });
  const keepIds = new Set(input.images.map((image) => image.id).filter(Boolean) as string[]);

  const removeIds = existing.filter((image) => !keepIds.has(image.id)).map((image) => image.id);
  if (removeIds.length > 0) {
    await tx.productImage.deleteMany({ where: { id: { in: removeIds }, productId } });
  }

  // The first image is the primary image unless one is explicitly flagged.
  const explicitPrimary = input.images.findIndex((image) => image.isPrimary);
  const primaryIndex = explicitPrimary >= 0 ? explicitPrimary : 0;

  for (const [index, image] of input.images.entries()) {
    const data = {
      url: image.url,
      altText: image.altText ?? null,
      position: index,
      isPrimary: index === primaryIndex,
    };

    if (image.id && !image.id.startsWith('tmp_')) {
      await tx.productImage.updateMany({ where: { id: image.id, productId }, data });
    } else {
      await tx.productImage.create({ data: { ...data, productId } });
    }
  }
}

/**
 * Reconcile options, option values and variants.
 *
 * Existing variants are matched by signature so their price, SKU and stock
 * survive a regeneration. Removing an option value removes only the variants
 * that used it.
 */
async function syncOptionsAndVariants(
  tx: DbClient,
  productId: string,
  input: ProductInput,
): Promise<void> {
  await tx.productOption.deleteMany({ where: { productId } });

  if (input.options.length === 0) {
    await tx.productVariant.deleteMany({ where: { productId } });
    return;
  }

  const optionInputs: OptionInput[] = [];

  for (const [optionIndex, option] of input.options.entries()) {
    const created = await tx.productOption.create({
      data: { productId, name: option.name, position: optionIndex },
      select: { id: true },
    });

    const values: OptionInput['values'] = [];
    for (const [valueIndex, value] of option.values.entries()) {
      const createdValue = await tx.productOptionValue.create({
        data: { optionId: created.id, value: value.value, position: valueIndex },
        select: { id: true },
      });
      values.push({ id: createdValue.id, value: value.value, position: valueIndex });
    }

    optionInputs.push({ id: created.id, name: option.name, position: optionIndex, values });
  }

  const combinations = generateCombinations(optionInputs);

  // Option value rows were recreated, so signatures from the previous save no
  // longer line up by id. Variants are instead matched by their human title,
  // which is stable across a save for an unchanged combination.
  const existing = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true, signature: true, title: true, sku: true, barcode: true, price: true, compareAtPrice: true, cost: true, stockQuantity: true, isActive: true, imageId: true },
  });
  const byTitle = new Map(existing.map((variant) => [variant.title, variant]));

  const submittedByTitle = new Map(input.variants.map((variant) => [variant.title, variant]));

  const reconciliation = reconcileVariants(
    combinations,
    existing.map((variant) => ({ id: variant.id, signature: variant.signature })),
  );

  if (reconciliation.toRemove.length > 0) {
    await tx.productVariant.deleteMany({
      where: { id: { in: reconciliation.toRemove.map((variant) => variant.id) }, productId },
    });
  }

  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: { sku: true },
  });

  await tx.productVariant.deleteMany({ where: { productId } });

  for (const [index, combination] of combinations.entries()) {
    const submitted = submittedByTitle.get(combination.title);
    const previous = byTitle.get(combination.title);

    const variant = await tx.productVariant.create({
      data: {
        productId,
        signature: combination.signature,
        title: combination.title,
        position: index,
        sku:
          submitted?.sku ??
          previous?.sku ??
          suggestVariantSku(product.sku, combination.title),
        barcode: submitted?.barcode ?? previous?.barcode ?? null,
        price: submitted?.price ?? previous?.price ?? null,
        compareAtPrice: submitted?.compareAtPrice ?? previous?.compareAtPrice ?? null,
        cost: submitted?.cost ?? previous?.cost ?? null,
        stockQuantity: submitted?.stockQuantity ?? previous?.stockQuantity ?? 0,
        isActive: submitted?.isActive ?? previous?.isActive ?? true,
        imageId: null,
      },
      select: { id: true },
    });

    await tx.variantOptionValue.createMany({
      data: combination.optionValueIds.map((optionValueId) => ({
        variantId: variant.id,
        optionValueId,
      })),
      skipDuplicates: true,
    });
  }
}

/** A variable product's stock is the sum of its active variants' stock. */
export async function recalculateProductStock(tx: DbClient, productId: string): Promise<void> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { hasVariants: true },
  });
  if (!product?.hasVariants) return;

  const aggregate = await tx.productVariant.aggregate({
    where: { productId, isActive: true },
    _sum: { stockQuantity: true },
  });

  await tx.product.update({
    where: { id: productId },
    data: { stockQuantity: aggregate._sum.stockQuantity ?? 0 },
  });
}

// ---------------------------------------------------------------------------
// Lightweight reads used by other modules
// ---------------------------------------------------------------------------

export interface ProductPickerItem {
  id: string;
  name: string;
  price: number;
  sku: string | null;
  imageUrl: string | null;
  hasVariants: boolean;
  variants: Array<{ id: string; title: string; price: number | null; stockQuantity: number }>;
}

export async function searchProductsForPicker(
  context: StoreContext,
  search: string,
  limit = 20,
): Promise<ProductPickerItem[]> {
  assertPermission(context, 'products.view');

  const rows = await prisma.product.findMany({
    where: {
      storeId: context.storeId,
      archivedAt: null,
      status: { not: 'ARCHIVED' },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      price: true,
      sku: true,
      hasVariants: true,
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      variants: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: { id: true, title: true, price: true, stockQuantity: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    sku: row.sku,
    imageUrl: row.images[0]?.url ?? null,
    hasVariants: row.hasVariants,
    variants: row.variants,
  }));
}
