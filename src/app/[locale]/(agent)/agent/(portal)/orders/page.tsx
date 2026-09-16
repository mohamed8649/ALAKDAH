import type { Metadata } from 'next';

import { AgentOrderQueue } from '@/features/call-center/agent-order-queue';
import { getTranslations } from '@/i18n/server';
import { requireAgentContext } from '@/server/policies/context';
import { listOrders } from '@/server/services/order-service';
import { orderFilterSchema } from '@/validators/order';

export const metadata: Metadata = { title: 'طلباتي' };
export const dynamic = 'force-dynamic';

/**
 * Agent queue.
 *
 * The agent context scopes `listOrders` to this agent's own assignments — the
 * restriction lives in the service, not here, so it cannot be bypassed by
 * crafting a query string.
 */
export default async function AgentOrdersPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { context } = await requireAgentContext();
  const t = getTranslations(params.locale, 'callCenter.portal');

  const filter = orderFilterSchema.parse(flatten(searchParams));
  const result = await listOrders(context, { ...filter, perPage: 20 });

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{t('subtitle')}</p>
      </header>

      <AgentOrderQueue
        result={JSON.parse(JSON.stringify(result))}
        locale={params.locale}
        currency={context.currency}
        country={context.country}
      />
    </div>
  );
}

function flatten(searchParams: Record<string, string | string[] | undefined>) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) result[key] = first;
  }
  return result;
}
