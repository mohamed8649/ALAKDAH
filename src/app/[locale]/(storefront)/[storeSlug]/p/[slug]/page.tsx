import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { BlockRenderer } from '@/features/pages/block-renderer';
import { LandingOrderForm } from '@/features/pages/landing-order-form';
import { prisma } from '@/db/client';
import { getStorefront } from '@/server/services/storefront-service';
import { getPublishedPage } from '@/server/services/page-service';
import { getCheckoutFields, listTrustBadges } from '@/server/services/store-service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { storeSlug: string; slug: string };
}): Promise<Metadata> {
  const store = await getStorefront(params.storeSlug);
  if (!store) return {};

  const page = await getPublishedPage(store.id, params.slug);
  if (!page) return {};

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
  };
}

/**
 * Public landing page.
 *
 * Renders the stored document through the same block components the builder
 * previews. The order form is injected as a slot so a landing page can take a
 * COD order without leaving the page.
 */
export default async function PublicLandingPage({
  params,
}: {
  params: { locale: string; storeSlug: string; slug: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const page = await getPublishedPage(store.id, params.slug);
  if (!page) notFound();

  // Only the products this page actually references are loaded.
  const referencedIds = new Set<string>();
  for (const block of page.document.blocks) {
    const id = (block.props as { productId?: string | null }).productId;
    if (id) referencedIds.add(id);
  }
  if (page.productId) referencedIds.add(page.productId);

  const [products, badges, fields] = await Promise.all([
    prisma.product.findMany({
      where: {
        storeId: store.id,
        status: 'ACTIVE',
        visibility: 'VISIBLE',
        archivedAt: null,
        ...(referencedIds.size > 0 ? {} : {}),
      },
      take: 24,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      },
    }),
    listTrustBadges(store.id, true),
    getCheckoutFields(store.id),
  ]);

  const productMap = Object.fromEntries(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        imageUrl: product.images[0]?.url ?? null,
      },
    ]),
  );

  const formProductId = page.productId ?? products[0]?.id ?? null;

  return (
    <div>
      {page.document.blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          context={{
            currency: store.currency,
            locale: params.locale,
            badges: badges.map((badge) => ({
              id: badge.id,
              title: badge.title,
              description: badge.description,
              icon: badge.icon,
            })),
            products: productMap,
            orderFormSlot: formProductId ? (
              <LandingOrderForm
                storeSlug={store.slug}
                productId={formProductId}
                landingPageId={page.id}
                currency={store.currency}
                price={productMap[formProductId]?.price ?? 0}
                fields={fields.map((field) => ({ fieldKey: field.fieldKey, mode: field.mode }))}
                locale={params.locale}
              />
            ) : null,
          }}
        />
      ))}
    </div>
  );
}
