import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { AbandonedList, type AbandonedItem } from '@/features/orders/abandoned-list';
import { getTranslations } from '@/i18n/server';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listAbandoned } from '@/server/services/checkout-service';
import { getStore, getStoreSettings } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'الطلبات المتروكة' };
export const dynamic = 'force-dynamic';

export default async function AbandonedPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { status?: string };
}) {
  const context = await requirePermission('orders.view');
  const t = getTranslations(params.locale, 'abandoned');

  const status =
    searchParams.status === 'RECOVERED' || searchParams.status === 'DISMISSED'
      ? searchParams.status
      : searchParams.status === 'ALL'
        ? 'ALL'
        : 'OPEN';

  const [rows, store, settings] = await Promise.all([
    listAbandoned(context, status),
    getStore(context.storeId),
    getStoreSettings(context.storeId),
  ]);

  const items: AbandonedItem[] = rows.map((row) => ({
    id: row.id,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    state: row.state,
    city: row.city,
    itemCount: row.itemCount,
    value: row.value,
    checkoutStep: row.checkoutStep,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <AbandonedList
        items={items}
        currency={store.currency}
        locale={params.locale}
        canDismiss={hasPermission(context, 'orders.edit')}
        trackingEnabled={settings.abandonedTrackingEnabled}
      />
    </div>
  );
}
