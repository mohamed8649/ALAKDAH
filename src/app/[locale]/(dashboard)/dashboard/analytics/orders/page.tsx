import type { Metadata } from 'next';

import { OrderAnalyticsView } from '@/features/analytics/order-analytics';
import { requirePermission } from '@/server/policies/context';
import { resolveDateRange, type DateRangePreset } from '@/lib/datetime';
import {
  getOrderMetrics,
  getOrdersByRegion,
  getOrdersOverTime,
  getTopProducts,
} from '@/server/services/analytics-service';

export const metadata: Metadata = { title: 'تقرير الطلبات' };
export const dynamic = 'force-dynamic';

export default async function OrderAnalyticsPage({
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

  const [metrics, series, topProducts, regions] = await Promise.all([
    getOrderMetrics(context, range),
    getOrdersOverTime(context, range),
    getTopProducts(context, range, 10),
    getOrdersByRegion(context, range, 10),
  ]);

  return (
    <OrderAnalyticsView
      metrics={metrics}
      series={series}
      topProducts={topProducts}
      regions={regions}
      preset={preset}
      locale={params.locale}
      currency={context.currency}
    />
  );
}
