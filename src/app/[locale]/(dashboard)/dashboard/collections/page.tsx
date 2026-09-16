import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { CollectionsManager, type CollectionRow } from '@/features/products/collections-manager';
import { getTranslations } from '@/i18n/server';
import { prisma } from '@/db/client';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listCollections } from '@/server/services/collection-service';

export const metadata: Metadata = { title: 'المجموعات' };
export const dynamic = 'force-dynamic';

export default async function CollectionsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('products.view');
  const t = getTranslations(params.locale, 'collections');

  const [collections, links, products] = await Promise.all([
    listCollections(context),
    // Membership is loaded in one query rather than per collection, so the
    // page cost does not grow with the number of collections.
    prisma.productCollection.findMany({
      where: { collection: { storeId: context.storeId } },
      select: { collectionId: true, productId: true },
    }),
    prisma.product.findMany({
      where: { storeId: context.storeId, archivedAt: null },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true },
    }),
  ]);

  const byCollection = new Map<string, string[]>();
  for (const link of links) {
    const current = byCollection.get(link.collectionId);
    if (current) current.push(link.productId);
    else byCollection.set(link.collectionId, [link.productId]);
  }

  const rows: CollectionRow[] = collections.map((collection) => ({
    id: collection.id,
    title: collection.title,
    handle: collection.handle,
    description: collection.description,
    imageUrl: collection.imageUrl,
    isActive: collection.isActive,
    productCount: collection.productCount,
    productIds: byCollection.get(collection.id) ?? [],
  }));

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <CollectionsManager
        collections={rows}
        products={products}
        canManage={hasPermission(context, 'products.edit')}
      />
    </div>
  );
}
