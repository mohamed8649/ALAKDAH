import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { OrderDetailView } from '@/features/orders/order-detail';
import { getTranslations } from '@/i18n/server';
import { AppError } from '@/lib/errors';
import { requireAgentContext } from '@/server/policies/context';
import { getOrder } from '@/server/services/order-service';

export const metadata: Metadata = { title: 'تفاصيل الطلب' };
export const dynamic = 'force-dynamic';

/**
 * Agent order detail.
 *
 * Reuses the merchant's order view with the agent's narrower permission set:
 * they can change status and edit notes, but carrier assignment and the
 * delivery slip are not theirs.
 */
export default async function AgentOrderPage({
  params,
}: {
  params: { locale: string; orderId: string };
}) {
  const { context } = await requireAgentContext();
  const t = getTranslations(params.locale, 'callCenter.portal');

  let order;
  try {
    order = await getOrder(context, params.orderId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  return (
    <OrderDetailView
      order={JSON.parse(JSON.stringify(order))}
      locale={params.locale}
      currency={context.currency}
      timezone={context.timezone}
      country={context.country}
      backHref={`/${params.locale}/agent/orders`}
      backLabel={t('title')}
      agents={[]}
      providers={[]}
      canChangeStatus={context.permissions.includes('orders.change_status')}
      canEdit={context.permissions.includes('orders.edit')}
      canAssign={false}
      canPrintSlip={false}
    />
  );
}
