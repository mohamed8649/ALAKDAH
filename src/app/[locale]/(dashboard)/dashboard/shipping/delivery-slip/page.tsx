import type { Metadata } from 'next';

import { DeliverySlipEditor } from '@/features/shipping/delivery-slip-editor';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { getDeliverySlipConfig } from '@/server/services/shipping-service';
import { getStore } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'وصل التوصيل' };
export const dynamic = 'force-dynamic';

export default async function DeliverySlipPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('shipping.view');

  const [config, store] = await Promise.all([
    getDeliverySlipConfig(context.storeId),
    getStore(context.storeId),
  ]);

  return (
    <DeliverySlipEditor
      config={JSON.parse(JSON.stringify(config))}
      store={{
        name: store.name,
        phone: store.phone,
        logoUrl: store.logoUrl,
      }}
      locale={params.locale}
      currency={context.currency}
      canManage={hasPermission(context, 'shipping.manage')}
    />
  );
}
