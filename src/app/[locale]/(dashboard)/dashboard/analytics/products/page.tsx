import type { Metadata } from 'next';

import { ProductAnalyticsView } from '@/features/analytics/product-analytics';
import { requirePermission } from '@/server/policies/context';
import { resolveDateRange, type DateRangePreset } from '@/lib/datetime';
import { getProductAnalytics } from '@/server/services/analytics-service';

export const metadata: Metadata = { title: 'تقرير المنتجات' };
export const dynamic = 'force-dynamic';

export default async function ProductAnalyticsPage({
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

  const { rows, totalViews, hasEnoughEvents } = await getProductAnalytics(context, range, 50);

  return (
    <ProductAnalyticsView
      rows={rows}
      totalViews={totalViews}
      hasEnoughEvents={hasEnoughEvents}
      preset={preset}
      locale={params.locale}
      currency={context.currency}
    />
  );
}
