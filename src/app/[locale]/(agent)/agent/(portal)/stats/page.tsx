import type { Metadata } from 'next';

import { Card, CardBody } from '@/components/ui/card';
import { StatCard } from '@/components/data-display/stat-card';
import { getTranslations } from '@/i18n/server';
import { formatNumber, formatPercent } from '@/lib/money';
import { prisma } from '@/db/client';
import { requireAgentContext } from '@/server/policies/context';

export const metadata: Metadata = { title: 'أدائي' };
export const dynamic = 'force-dynamic';

/**
 * Agent performance.
 *
 * Only metrics computable from this agent's own orders. The confirmation rate
 * is null rather than 0% when nothing has been assigned yet — an agent on their
 * first day is not failing.
 */
export default async function AgentStatsPage({ params }: { params: { locale: string } }) {
  const { context, agent } = await requireAgentContext();
  const t = getTranslations(params.locale, 'callCenter.portal');
  const tAnalytics = getTranslations(params.locale, 'analytics');

  const grouped = await prisma.order.groupBy({
    by: ['status'],
    where: { storeId: context.storeId, assignedAgentId: agent.id },
    _count: { _all: true },
  });

  const countFor = (statuses: readonly string[]) =>
    grouped
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);

  const assigned = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const confirmed = countFor([
    'CONFIRMED', 'PROCESSING', 'READY_FOR_SHIPPING', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED',
  ]);
  const cancelled = countFor(['CANCELLED']);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">{t('myStats')}</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t('assigned')} value={formatNumber(assigned, params.locale)} tone="info" />
        <StatCard label={t('confirmed')} value={formatNumber(confirmed, params.locale)} tone="success" />
        <StatCard label={t('cancelled')} value={formatNumber(cancelled, params.locale)} tone="danger" />
        <StatCard
          label={t('confirmationRate')}
          value={assigned > 0 ? formatPercent((confirmed / assigned) * 100, params.locale) : null}
          definition={tAnalytics('definitionText.confirmationRate')}
          tone="primary"
        />
      </div>

      {assigned === 0 ? (
        <Card className="mt-3">
          <CardBody className="text-center text-[13px] text-muted-foreground">
            {t('emptyHint')}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
