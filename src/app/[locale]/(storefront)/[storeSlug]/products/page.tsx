import { notFound } from 'next/navigation';
import { Package, Search } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/states';
import { ProductCard } from '@/features/storefront/product-card';
import { StorefrontPagination } from '@/features/storefront/storefront-pagination';
import { getTranslations } from '@/i18n/server';
import { getStorefront, listStorefrontProducts } from '@/server/services/storefront-service';

export const metadata: Metadata = { title: 'المنتجات' };
export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

export default async function StorefrontProductsPage({
  params,
  searchParams,
}: {
  params: { locale: string; storeSlug: string };
  searchParams: { q?: string; page?: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const t = getTranslations(params.locale, 'storefront');
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { items, total } = await listStorefrontProducts(store.id, {
    search: searchParams.q,
    limit: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  const base = `/${params.locale}/${store.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold text-foreground">
        {searchParams.q ? `${t('search')}: ${searchParams.q}` : t('products')}
      </h1>

      {items.length === 0 ? (
        <EmptyState
          icon={searchParams.q ? <Search /> : <Package />}
          title={t('noProducts')}
          description={t('noProductsHint')}
        />
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
            basePath={`${base}/products`}
            query={searchParams.q ? { q: searchParams.q } : {}}
          />
        </>
      )}
    </div>
  );
}
