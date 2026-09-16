import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/states';
import { ProductCard } from '@/features/storefront/product-card';
import { StorefrontPagination } from '@/features/storefront/storefront-pagination';
import { prisma } from '@/db/client';
import { getTranslations } from '@/i18n/server';
import { getStorefront, listStorefrontProducts } from '@/server/services/storefront-service';

export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

export async function generateMetadata({
  params,
}: {
  params: { storeSlug: string; handle: string };
}): Promise<Metadata> {
  const store = await getStorefront(params.storeSlug);
  if (!store) return {};

  const collection = await prisma.collection.findFirst({
    where: { storeId: store.id, handle: params.handle, isActive: true },
    select: { title: true, description: true },
  });

  return collection
    ? { title: collection.title, description: collection.description ?? undefined }
    : {};
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: { locale: string; storeSlug: string; handle: string };
  searchParams: { page?: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const collection = await prisma.collection.findFirst({
    where: { storeId: store.id, handle: params.handle, isActive: true },
    select: { title: true, description: true, imageUrl: true },
  });
  if (!collection) notFound();

  const t = getTranslations(params.locale, 'storefront');
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { items, total } = await listStorefrontProducts(store.id, {
    collectionHandle: params.handle,
    limit: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  const base = `/${params.locale}/${store.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">{collection.title}</h1>
        {collection.description ? (
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {collection.description}
          </p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <EmptyState icon={<Package />} title={t('noProducts')} description={t('noProductsHint')} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((product) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  href={`${base}/products/${product.slug}`}
                  currency={store.currency}
                />
              </li>
            ))}
          </ul>

          <StorefrontPagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / PER_PAGE))}
            basePath={`${base}/collections/${params.handle}`}
            query={{}}
          />
        </>
      )}
    </div>
  );
}
