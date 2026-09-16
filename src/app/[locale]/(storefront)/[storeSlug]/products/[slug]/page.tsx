import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { ProductDetail } from '@/features/storefront/product-detail';
import { getStorefront, getStorefrontProduct } from '@/server/services/storefront-service';
import { listTrustBadges } from '@/server/services/store-service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { storeSlug: string; slug: string };
}): Promise<Metadata> {
  const store = await getStorefront(params.storeSlug);
  if (!store) return {};

  const product = await getStorefrontProduct(store.id, params.slug);
  if (!product) return {};

  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
    openGraph: {
      title: product.seoTitle ?? product.name,
      description: product.seoDescription ?? product.shortDescription ?? undefined,
      images: product.images[0] ? [product.images[0].url] : undefined,
    },
  };
}

export default async function StorefrontProductPage({
  params,
}: {
  params: { locale: string; storeSlug: string; slug: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const product = await getStorefrontProduct(store.id, params.slug);
  if (!product) notFound();

  const badges = await listTrustBadges(store.id, true);

  return (
    <ProductDetail
      product={product}
      store={{ slug: store.slug, currency: store.currency }}
      badges={badges.map((badge) => ({
        id: badge.id,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
      }))}
      cartEnabled={store.settings.cartEnabled}
      locale={params.locale}
    />
  );
}
