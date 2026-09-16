import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { CheckoutForm } from '@/features/storefront/checkout-form';
import { prisma } from '@/db/client';
import { getStorefront } from '@/server/services/storefront-service';
import {
  getCheckoutFields,
  listCustomFields,
  listTrustBadges,
} from '@/server/services/store-service';

export const metadata: Metadata = { title: 'إتمام الطلب', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  params,
}: {
  params: { locale: string; storeSlug: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const [fields, customFields, badges, zones] = await Promise.all([
    getCheckoutFields(store.id),
    listCustomFields(store.id, true),
    listTrustBadges(store.id, true),
    prisma.shippingZone.findMany({
      where: { storeId: store.id },
      select: { regions: true },
    }),
  ]);

  // Offer the regions the merchant actually prices as a dropdown; falls back to
  // a free-text field when no zone names any region.
  const regions = [...new Set(zones.flatMap((zone) => zone.regions))].sort();

  return (
    <CheckoutForm
      store={{
        slug: store.slug,
        currency: store.currency,
        country: store.country,
        cartEnabled: store.settings.cartEnabled,
      }}
      fields={fields.map((field) => ({ fieldKey: field.fieldKey, mode: field.mode }))}
      customFields={customFields.map((field) => ({
        id: field.id,
        fieldKey: field.fieldKey,
        label: field.label,
        type: field.type,
        placeholder: field.placeholder,
        helpText: field.helpText,
        required: field.required,
        options: field.options,
      }))}
      badges={badges.map((badge) => ({
        id: badge.id,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
      }))}
      regions={regions}
      locale={params.locale}
      codNotice
    />
  );
}
