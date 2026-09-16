import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { OrdersTable } from '@/features/orders/orders-table';
import { getTranslations } from '@/i18n/server';
import { hasPermission, requireStoreContext } from '@/server/policies/context';
import { listOrders } from '@/server/services/order-service';
import { listAgents } from '@/server/services/agent-service';
import { listProviders } from '@/server/services/shipping-service';
import { orderFilterSchema } from '@/validators/order';

export const metadata: Metadata = { title: 'الطلبات' };
export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const context = await requireStoreContext();
  const t = getTranslations(params.locale, 'orders');

  const filter = orderFilterSchema.parse(flatten(searchParams));

  // Agents and carriers populate the filter dropdowns; both are optional, so a
  // merchant without the call-center permission still gets the rest of the page.
  const [result, agents, providers] = await Promise.all([
    listOrders(context, filter),
    hasPermission(context, 'callcenter.view') ? listAgents(context) : Promise.resolve([]),
    hasPermission(context, 'shipping.view') ? listProviders(context) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          hasPermission(context, 'orders.create') ? (
            <Button asChild variant="primary" size="sm">
              <Link href={`/${params.locale}/dashboard/orders/new`}>
                <Plus aria-hidden />
                {t('create')}
              </Link>
            </Button>
          ) : null
        }
      />

      <OrdersTable
        result={result}
        filter={filter}
        locale={params.locale}
        currency={context.currency}
        timezone={context.timezone}
        agents={agents.map((agent) => ({ id: agent.id, name: agent.fullName }))}
        providers={providers
          .filter((provider) => provider.id !== null)
          .map((provider) => ({ id: provider.id!, name: provider.name }))}
        canChangeStatus={hasPermission(context, 'orders.change_status')}
        canExport={hasPermission(context, 'orders.export')}
        canAssign={hasPermission(context, 'orders.assign')}
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
