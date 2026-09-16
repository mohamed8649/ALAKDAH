'use client';

import { AreaChart, BarList, DonutChart } from '@/components/charts';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatDayLabel } from '@/lib/datetime';
import { formatMoney, formatMoneyCompact } from '@/lib/money';
import type { OrderStatus } from '@/features/orders/state-machine';

/**
 * Dashboard charts.
 *
 * Client components because they respond to hover. Everything they draw was
 * computed on the server; nothing is recalculated here.
 */

const STATUS_COLOURS: Record<OrderStatus, string> = {
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

export function DashboardCharts({
  series,
  statusCounts,
  topProducts,
  regions,
  currency,
}: {
  series: Array<{ key: string; orders: number; sales: number }>;
  statusCounts: Record<OrderStatus, number>;
  topProducts: Array<{ productId: string | null; name: string; unitsSold: number; revenue: number }>;
  regions: Array<{ region: string; orders: number; sales: number }>;
  currency: string;
}) {
  const t = useTranslations('dashboard.charts');
  const tStatus = useTranslations('orders.status');
  const tMetrics = useTranslations('analytics.metrics');
  const locale = useLocale();

  const salesPoints = series.map((point) => ({
    key: point.key,
    label: formatDayLabel(point.key, locale),
    value: point.sales,
  }));

  const orderPoints = series.map((point) => ({
    key: point.key,
    label: formatDayLabel(point.key, locale),
    value: point.orders,
  }));

  const totalOrders = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);

  const statusSlices = (Object.keys(statusCounts) as OrderStatus[])
    .map((status) => ({
      key: status,
      label: tStatus(status),
      value: statusCounts[status],
      color: STATUS_COLOURS[status],
    }))
    .filter((slice) => slice.value > 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('salesOverview')} />
          <CardBody>
            <AreaChart
              data={salesPoints}
              title={t('salesOverview')}
              valueLabel={tMetrics('totalSales')}
              formatValue={(value) => formatMoney(value, currency, locale)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('ordersOverTime')} />
          <CardBody>
            <AreaChart
              data={orderPoints}
              title={t('ordersOverTime')}
              valueLabel={tMetrics('totalOrders')}
              color="var(--info)"
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('statusDistribution')} />
          <CardBody>
            <DonutChart
              data={statusSlices}
              title={t('statusDistribution')}
              valueLabel={tMetrics('totalOrders')}
              centerValue={String(totalOrders)}
              centerLabel={tMetrics('totalOrders')}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('topProducts')} />
          <CardBody>
            <BarList
              data={topProducts.map((product) => ({
                key: product.productId ?? product.name,
                label: product.name,
                value: product.revenue,
              }))}
              title={t('topProducts')}
              valueLabel={tMetrics('revenue')}
              formatValue={(value) => formatMoneyCompact(value, currency, locale)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('ordersByRegion')} />
          <CardBody>
            <BarList
              data={regions.map((region) => ({
                key: region.region,
                label: region.region,
                value: region.orders,
              }))}
              title={t('ordersByRegion')}
              valueLabel={tMetrics('totalOrders')}
              color="var(--accent)"
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
