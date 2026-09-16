import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { OrderDetailView } from '@/features/orders/order-detail';
import { getTranslations } from '@/i18n/server';
import { AppError } from '@/lib/errors';
import { hasPermission, requireStoreContext } from '@/server/policies/context';
import { getOrder } from '@/server/services/order-service';
import { listAgents } from '@/server/services/agent-service';
import { listProviders } from '@/server/services/shipping-service';

export const metadata: Metadata = { title: 'تفاصيل الطلب' };
export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
}: {
  params: { locale: string; orderId: string };
}) {
  const context = await requireStoreContext();
  const t = getTranslations(params.locale, 'orders');

  let order;
  try {
    order = await getOrder(context, params.orderId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const [agents, providers] = await Promise.all([
    hasPermission(context, 'callcenter.view') ? listAgents(context) : Promise.resolve([]),
    hasPermission(context, 'shipping.view') ? listProviders(context) : Promise.resolve([]),
  ]);

  return (
    <OrderDetailView
      order={JSON.parse(JSON.stringify(order))}
      locale={params.locale}
      currency={context.currency}
      timezone={context.timezone}
      country={context.country}
      backHref={`/${params.locale}/dashboard/orders`}
      backLabel={t('title')}
      agents={agents.map((agent) => ({ id: agent.id, name: agent.fullName }))}
      providers={providers
        .filter((provider) => provider.id !== null)
        .map((provider) => ({ id: provider.id!, name: provider.name }))}
      canChangeStatus={hasPermission(context, 'orders.change_status')}
      canEdit={hasPermission(context, 'orders.edit')}
      canAssign={hasPermission(context, 'orders.assign')}
      canPrintSlip={hasPermission(context, 'shipping.view')}
    />
  );
}
