'use client';

import { BarChart3 } from 'lucide-react';

import { AreaChart, BarList, DonutChart } from '@/components/charts';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { StatCard } from '@/components/data-display/stat-card';
import { DateRangeTabs } from '@/features/analytics/date-range-tabs';
import type { OrderStatus } from '@/features/orders/state-machine';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatDayLabel } from '@/lib/datetime';
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent } from '@/lib/money';
import type { OrderMetrics } from '@/server/services/analytics-service';

const STATUS_COLOURS: Record<string, string> = {
  NEW: 'var(--info)',
  CONFIRMED: 'var(--primary)',
  PROCESSING: 'var(--warning)',
  READY_FOR_SHIPPING: 'var(--warning)',
  SHIPPED: 'var(--accent)',
  DELIVERED: 'var(--success)',
  CANCELLED: 'var(--danger)',
  DELIVERY_FAILED: 'var(--danger)',
  RETURNED: 'var(--muted-foreground)',
};

/**
 * Order analytics.
 *
 * Every rate carries its definition in a tooltip, and any metric whose
 * denominator is zero renders as "—" rather than 0%. A merchant should never
 * have to guess whether a number means "bad" or "not enough data".
 */
export function OrderAnalyticsView({
  metrics,
  series,
  topProducts,
  regions,
  preset,
  locale,
  currency,
}: {
  metrics: OrderMetrics;
  series: Array<{ key: string; orders: number; sales: number }>;
  topProducts: Array<{ productId: string | null; name: string; revenue: number; unitsSold: number }>;
  regions: Array<{ region: string; orders: number; sales: number }>;
  preset: string;
  locale: string;
  currency: string;
}) {
  const t = useTranslations('analytics');
  const tCharts = useTranslations('dashboard.charts');
  const tStatus = useTranslations('orders.status');
  const currentLocale = useLocale();

  const statusSlices = (Object.keys(metrics.statusCounts) as OrderStatus[])
    .map((status) => ({
      key: status,
      label: tStatus(status),
      value: metrics.statusCounts[status],
      color: STATUS_COLOURS[status] ?? 'var(--muted-foreground)',
    }))
    .filter((slice) => slice.value > 0);

  return (
    <div>
      <DateRangeTabs preset={preset} />

      {!metrics.hasData ? (
        <Card>
          <EmptyState icon={<BarChart3 />} title={t('noData')} description={t('noDataHint')} />
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('metrics.totalOrders')}
              value={formatNumber(metrics.totalOrders, locale)}
              tone="primary"
            />
            <StatCard
              label={t('metrics.totalSales')}
              value={formatMoneyCompact(metrics.totalSales, currency, locale)}
              tone="success"
            />
            <StatCard
              label={t('metrics.deliveryRate')}
              value={metrics.deliveryRate === null ? null : formatPercent(metrics.deliveryRate, locale)}
              definition={t('definitionText.deliveryRate')}
              hint={`${formatNumber(metrics.deliveredOrders, locale)} / ${formatNumber(metrics.shippedEligible, locale)}`}
              tone="info"
            />
            <StatCard
              label={t('metrics.averageOrderValue')}
              value={
                metrics.averageOrderValue === null
                  ? null
                  : formatMoney(metrics.averageOrderValue, currency, locale)
              }
              definition={t('definitionText.averageOrderValue')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('metrics.returnRate')}
              value={metrics.returnRate === null ? null : formatPercent(metrics.returnRate, locale)}
              definition={t('definitionText.returnRate')}
              tone="warning"
            />
            <StatCard
              label={t('metrics.cancellationRate')}
              value={
                metrics.cancellationRate === null
                  ? null
                  : formatPercent(metrics.cancellationRate, locale)
              }
              definition={t('definitionText.cancellationRate')}
              tone="danger"
            />
            <StatCard
              label={t('metrics.averageDaily')}
              value={metrics.averageDaily.toFixed(1)}
            />
            <StatCard
              label={t('metrics.deliveredOrders')}
              value={formatNumber(metrics.deliveredOrders, locale)}
              tone="success"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader title={tCharts('salesOverview')} />
              <CardBody>
                <AreaChart
                  data={series.map((point) => ({
                    key: point.key,
                    label: formatDayLabel(point.key, currentLocale),
                    value: point.sales,
                  }))}
                  title={tCharts('salesOverview')}
                  valueLabel={t('metrics.totalSales')}
                  formatValue={(value) => formatMoney(value, currency, currentLocale)}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={tCharts('ordersOverTime')} />
              <CardBody>
                <AreaChart
                  data={series.map((point) => ({
                    key: point.key,
                    label: formatDayLabel(point.key, currentLocale),
                    value: point.orders,
                  }))}
                  title={tCharts('ordersOverTime')}
                  valueLabel={t('metrics.totalOrders')}
                  color="var(--info)"
                />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card>
              <CardHeader title={tCharts('statusDistribution')} />
              <CardBody>
                <DonutChart
                  data={statusSlices}
                  title={tCharts('statusDistribution')}
                  valueLabel={t('metrics.totalOrders')}
                  centerValue={formatNumber(metrics.totalOrders, currentLocale)}
                  centerLabel={t('metrics.totalOrders')}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={tCharts('topProducts')} />
              <CardBody>
                <BarList
                  data={topProducts.map((product) => ({
                    key: product.productId ?? product.name,
                    label: product.name,
                    value: product.revenue,
                  }))}
                  title={tCharts('topProducts')}
                  valueLabel={t('metrics.revenue')}
                  maxItems={8}
                  formatValue={(value) => formatMoneyCompact(value, currency, currentLocale)}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={tCharts('ordersByRegion')} />
              <CardBody>
                <BarList
                  data={regions.map((region) => ({
                    key: region.region,
                    label: region.region,
                    value: region.orders,
                  }))}
                  title={tCharts('ordersByRegion')}
                  valueLabel={t('metrics.totalOrders')}
                  maxItems={8}
                  color="var(--accent)"
                />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
