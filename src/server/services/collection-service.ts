import 'server-only';

import { prisma } from '@/db/client';
import { AppError } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/lib/slug';
import { assertPermission, type StoreContext } from '@/server/policies/context';

/**
 * Collections.
 *
 * A merchant-facing grouping that the storefront navigates by handle. Unlike a
 * category, a product can sit in several collections, and a collection is
 * allowed to be empty — it is a merchandising surface, not a taxonomy.
 *
 * Deleting a collection removes the grouping, never the products in it.
 */

export interface CollectionListItem {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  position: number;
  productCount: number;
}

export async function listCollections(context: StoreContext): Promise<CollectionListItem[]> {
  assertPermission(context, 'products.view');

  const collections = await prisma.collection.findMany({
    where: { storeId: context.storeId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      handle: true,
      description: true,
      imageUrl: true,
      isActive: true,
      position: true,
      _count: { select: { products: true } },
    },
  });

  return collections.map((collection) => ({
    id: collection.id,
    title: collection.title,
    handle: collection.handle,
    description: collection.description,
    imageUrl: collection.imageUrl,
    isActive: collection.isActive,
    position: collection.position,
    productCount: collection._count.products,
  }));
}

export interface CollectionInput {
  title: string;
  handle?: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  productIds: string[];
}

export async function saveCollection(
  context: StoreContext,
  collectionId: string | null,
  input: CollectionInput,
): Promise<{ id: string; handle: string }> {
  assertPermission(context, 'products.edit');

  const base =
    input.handle && input.handle.length > 0 ? slugify(input.handle, 'collection') : slugify(input.title, 'collection');

  const conflicts = await prisma.collection.findMany({
    where: {
      storeId: context.storeId,
      handle: { startsWith: base },
      ...(collectionId ? { NOT: { id: collectionId } } : {}),
    },
    select: { handle: true },
  });
  const handle = uniqueSlug(base, new Set(conflicts.map((row) => row.handle)));

  // Products are matched against this store before being linked, so a crafted
  // id cannot pull another tenant's product into a collection.
  const products = await prisma.product.findMany({
    where: { id: { in: input.productIds }, storeId: context.storeId, archivedAt: null },
    select: { id: true },
  });

  const data = {
    title: input.title,
    handle,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    isActive: input.isActive,
  };

  return prisma.$transaction(async (tx) => {
    let id = collectionId;

    if (id) {
      const existing = await tx.collection.findFirst({
        where: { id, storeId: context.storeId },
        select: { id: true },
      });
      if (!existing) throw new AppError('NOT_FOUND', 'Collection not found.');

      await tx.collection.update({ where: { id }, data });
      await tx.productCollection.deleteMany({ where: { collectionId: id } });
    } else {
      const max = await tx.collection.aggregate({
        where: { storeId: context.storeId },
        _max: { position: true },
      });

      const created = await tx.collection.create({
        data: { ...data, storeId: context.storeId, position: (max._max.position ?? 0) + 1 },
        select: { id: true },
      });
      id = created.id;
    }

    if (products.length > 0) {
      await tx.productCollection.createMany({
        data: products.map((product) => ({ collectionId: id!, productId: product.id })),
        skipDuplicates: true,
      });
    }

    return { id, handle };
  });
}

export async function deleteCollection(context: StoreContext, collectionId: string): Promise<void> {
  assertPermission(context, 'products.edit');

  const result = await prisma.collection.deleteMany({
    where: { id: collectionId, storeId: context.storeId },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Collection not found.');
}

export async function getCollectionProductIds(
  context: StoreContext,
  collectionId: string,
): Promise<string[]> {
  assertPermission(context, 'products.view');

  const links = await prisma.productCollection.findMany({
    where: { collectionId, collection: { storeId: context.storeId } },
    select: { productId: true },
  });

  return links.map((link) => link.productId);
}
