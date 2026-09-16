import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { OrderTrackingForm } from '@/features/storefront/order-tracking-form';
import { getStorefront } from '@/server/services/storefront-service';

export const metadata: Metadata = { title: 'تتبع الطلب' };
export const dynamic = 'force-dynamic';

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: { locale: string; storeSlug: string };
  searchParams: { order?: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();
  if (!store.settings.trackingEnabled) notFound();

  return (
    <OrderTrackingForm
      storeSlug={store.slug}
      method={store.settings.trackingMethod}
      currency={store.currency}
      timezone={store.timezone}
      defaultOrderNumber={(searchParams.order ?? '').slice(0, 20)}
      contactPhone={
        store.settings.quickContactPhoneEnabled ? store.settings.quickContactPhone : store.phone
      }
      country={store.country}
    />
  );
}
