import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { CartView } from '@/features/storefront/cart-view';
import { getStorefront } from '@/server/services/storefront-service';

export const metadata: Metadata = { title: 'السلة' };
export const dynamic = 'force-dynamic';

export default async function CartPage({
  params,
}: {
  params: { locale: string; storeSlug: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  // With the cart app disabled the store sells one product at a time, so a
  // cart page would be a dead end. Send the shopper to the catalogue instead.
  if (!store.settings.cartEnabled) {
    redirect(`/${params.locale}/${store.slug}/products`);
  }

  return <CartView storeSlug={store.slug} currency={store.currency} locale={params.locale} />;
}
