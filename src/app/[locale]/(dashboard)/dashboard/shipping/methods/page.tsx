import type { Metadata } from 'next';

import { ShippingMethodsManager } from '@/features/shipping/methods-manager';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listShippingMethods } from '@/server/services/shipping-service';

export const metadata: Metadata = { title: 'طرق التوصيل' };
export const dynamic = 'force-dynamic';

export default async function ShippingMethodsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('shipping.view');
  const methods = await listShippingMethods(context);

  return (
    <ShippingMethodsManager
      methods={JSON.parse(JSON.stringify(methods))}
      locale={params.locale}
      currency={context.currency}
      canManage={hasPermission(context, 'shipping.manage')}
    />
  );
}
