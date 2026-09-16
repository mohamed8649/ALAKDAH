import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { ProductCard } from '@/features/storefront/product-card';
import { TrustBadgeRow } from '@/features/storefront/trust-badges';
import { getTranslations } from '@/i18n/server';
import {
  getStorefront,
  listStorefrontCollections,
  listStorefrontProducts,
} from '@/server/services/storefront-service';
import { listTrustBadges } from '@/server/services/store-service';

export const dynamic = 'force-dynamic';

export default async function StorefrontHomePage({
  params,
}: {
  params: { locale: string; storeSlug: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const t = getTranslations(params.locale, 'storefront');

  const [{ items }, collections, badges] = await Promise.all([
    listStorefrontProducts(store.id, { limit: 12 }),
    listStorefrontCollections(store.id),
    listTrustBadges(store.id, true),
  ]);

  const base = `/${params.locale}/${store.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Hero — restrained by design: the merchant's products are the content,
          not a full-viewport marketing banner. */}
      <section className="rounded-[var(--radius-lg)] border border-border bg-surface-2 px-5 py-8 text-center sm:py-12">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{store.name}</h1>
        {store.description ? (
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {store.description}
          </p>
        ) : null}
        <Button asChild variant="primary" size="touch" className="mt-5">
          <Link href={`${base}/products`}>{t('products')}</Link>
        </Button>
      </section>

      {badges.length > 0 ? (
        <div className="mt-6">
          <TrustBadgeRow badges={badges.map((badge) => ({
            id: badge.id,
            title: badge.title,
            description: badge.description,
            icon: badge.icon,
          }))} />
        </div>
      ) : null}

      {collections.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t('collections')}</h2>
          <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`${base}/collections/${collection.handle}`}
                className="shrink-0 rounded-full border border-border px-4 py-2 text-[13px] text-foreground transition-colors duration-fast hover:border-border-strong hover:bg-surface-2"
              >
                {collection.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t('products')}</h2>
          {items.length > 0 ? (
            <Link href={`${base}/products`} className="text-xs text-primary hover:underline">
              {getTranslations(params.locale, 'app')('viewAll')}
            </Link>
          ) : null}
        </div>

        {items.length === 0 ? (
          <EmptyState icon={<Package />} title={t('noProducts')} description={t('noProductsHint')} />
        ) : (
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
        )}
      </section>
    </div>
  );
}
