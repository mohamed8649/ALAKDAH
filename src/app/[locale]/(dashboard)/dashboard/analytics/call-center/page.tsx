import { Headphones } from 'lucide-react';
import type { Metadata } from 'next';

import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { getTranslations } from '@/i18n/server';
import { formatNumber, formatPercent } from '@/lib/money';
import { resolveDateRange, type DateRangePreset } from '@/lib/datetime';
import { requirePermission } from '@/server/policies/context';
import { getAgentStats } from '@/server/services/agent-service';

export const metadata: Metadata = { title: 'تقرير مركز الاتصال' };
export const dynamic = 'force-dynamic';

export default async function CallCenterAnalyticsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const context = await requirePermission('analytics.view');

  const preset = (searchParams.range ?? 'last30') as DateRangePreset;
  const range = resolveDateRange(preset, context.timezone, {
    from: searchParams.from,
    to: searchParams.to,
  });

  const stats = await getAgentStats(context, { from: range.from, to: range.to });

  const t = getTranslations(params.locale, 'analytics');
  const tPortal = getTranslations(params.locale, 'callCenter.portal');
  const tCallCenter = getTranslations(params.locale, 'callCenter');

  if (stats.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Headphones />}
          title={tCallCenter('emptyAgents')}
          description={tCallCenter('emptyAgentsDescription')}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <ul className="divide-y divide-border">
          {stats.map((agent) => (
            <li key={agent.agentId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                {agent.fullName}
              </p>

              <dl className="flex shrink-0 items-center gap-4 text-xs">
                <Metric label={tPortal('assigned')} value={formatNumber(agent.assigned, params.locale)} />
                <Metric label={tPortal('confirmed')} value={formatNumber(agent.confirmed, params.locale)} />
                <Metric label={tPortal('cancelled')} value={formatNumber(agent.cancelled, params.locale)} />
                <Metric
                  label={tPortal('confirmationRate')}
                  value={
                    // An agent with no assignments shows a dash, not 0%.
                    agent.confirmationRate === null
                      ? '—'
                      : formatPercent(agent.confirmationRate, params.locale)
                  }
                />
              </dl>
            </li>
          ))}
        </ul>
      </CardBody>

      <div className="border-t border-border px-4 py-2.5">
        <p className="text-2xs text-subtle-foreground">{t('definitionText.confirmationRate')}</p>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-16 text-end">
      <dt className="truncate text-subtle-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
