import type { Metadata } from 'next';

import { ShippingRulesManager } from '@/features/shipping/rules-manager';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listProviders, listShippingRules } from '@/server/services/shipping-service';

export const metadata: Metadata = { title: 'قواعد الإسناد' };
export const dynamic = 'force-dynamic';

export default async function ShippingRulesPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('shipping.view');

  const [{ rules, overlaps }, providers] = await Promise.all([
    listShippingRules(context),
    listProviders(context),
  ]);

  return (
    <ShippingRulesManager
      rules={JSON.parse(JSON.stringify(rules))}
      overlaps={overlaps}
      providers={providers
        .filter((provider) => provider.id !== null && provider.isConnected)
        .map((provider) => ({ id: provider.id!, name: provider.name }))}
      locale={params.locale}
      currency={context.currency}
      canManage={hasPermission(context, 'shipping.manage')}
    />
  );
}
