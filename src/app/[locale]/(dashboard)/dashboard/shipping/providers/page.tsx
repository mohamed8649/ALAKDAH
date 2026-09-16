import type { Metadata } from 'next';

import { ShippingProvidersManager } from '@/features/shipping/providers-manager';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listProviders } from '@/server/services/shipping-service';

export const metadata: Metadata = { title: 'شركات التوصيل' };
export const dynamic = 'force-dynamic';

export default async function ShippingProvidersPage() {
  const context = await requirePermission('shipping.view');
  const providers = await listProviders(context);

  return (
    <ShippingProvidersManager
      providers={JSON.parse(JSON.stringify(providers))}
      canManage={hasPermission(context, 'shipping.manage')}
    />
  );
}
