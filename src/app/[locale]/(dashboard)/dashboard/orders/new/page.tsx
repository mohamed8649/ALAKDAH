import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { ManualOrderForm } from '@/features/orders/manual-order-form';
import { getTranslations } from '@/i18n/server';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listAgents } from '@/server/services/agent-service';
import { listShippingMethods } from '@/server/services/shipping-service';

export const metadata: Metadata = { title: 'طلب يدوي' };
export const dynamic = 'force-dynamic';

export default async function NewOrderPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('orders.create');
  const t = getTranslations(params.locale, 'orders');

  const [methods, agents] = await Promise.all([
    hasPermission(context, 'shipping.view') ? listShippingMethods(context) : Promise.resolve([]),
    hasPermission(context, 'callcenter.view') ? listAgents(context) : Promise.resolve([]),
  ]);

  const activeMethods = methods.filter((method) => method.isActive);
  const defaultMethod = activeMethods.find((method) => method.isDefault) ?? activeMethods[0];

  return (
    <div>
      <PageHeader
        title={t('createTitle')}
        backHref={`/${params.locale}/dashboard/orders`}
        backLabel={t('title')}
      />

      <ManualOrderForm
        locale={params.locale}
        currency={context.currency}
        shippingMethods={activeMethods.map((method) => ({
          id: method.id,
          name: method.name,
          price: method.price,
        }))}
        agents={agents
          .filter((agent) => agent.isActive)
          .map((agent) => ({ id: agent.id, name: agent.fullName }))}
        defaultShipping={defaultMethod?.price ?? 0}
      />
    </div>
  );
}
