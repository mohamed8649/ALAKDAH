import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  FileText,
  Package,
  Plus,
  ShoppingBag,
  TrendingUp,
  Truck,
  UserPlus,
} from 'lucide-react';
import type { Metadata } from 'next';

import { DashboardCharts } from '@/features/dashboard/dashboard-charts';
import { RecentOrders } from '@/features/dashboard/recent-orders';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { StatCard } from '@/components/data-display/stat-card';
import { getTranslations } from '@/i18n/server';
import { resolveDateRange } from '@/lib/datetime';
import { formatMoneyCompact, formatNumber, formatPercent } from '@/lib/money';
import { hasPermission, requireStoreContext } from '@/server/policies/context';
import {
  getComparisonMetrics,
  getOrderMetrics,
  getOrdersByRegion,
  getOrdersOverTime,
  getTopProducts,
  percentChange,
} from '@/server/services/analytics-service';
import { listOrders } from '@/server/services/order-service';
import { listLowStock } from '@/server/services/inventory-service';

export const metadata: Metadata = { title: 'لوحة التحكم' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { range?: string };
}) {
  const context = await requireStoreContext();
  const t = getTranslations(params.locale, 'dashboard');
  const tApp = getTranslations(params.locale, 'app');
  const tAnalytics = getTranslations(params.locale, 'analytics');

  const preset = (searchParams.range ?? 'last30') as 'today' | 'last7' | 'last30' | 'last90';
  const range = resolveDateRange(preset, context.timezone);

  const canSeeAnalytics = hasPermission(context, 'analytics.view');
  const canSeeOrders = hasPermission(context, 'orders.view');

  // Metrics, charts and the recent-order list load in parallel; a slow chart
  // must not delay the KPI row.
  const [metrics, comparison, series, topProducts, regions, recentOrders, lowStock] =
    await Promise.all([
      canSeeAnalytics ? getOrderMetrics(context, range) : null,
      canSeeAnalytics ? getComparisonMetrics(context, range) : null,
      canSeeAnalytics ? getOrdersOverTime(context, range) : null,
      canSeeAnalytics ? getTopProducts(context, range, 6) : null,
      canSeeAnalytics ? getOrdersByRegion(context, range, 6) : null,
      canSeeOrders
        ? listOrders(context, { sort: 'newest', page: 1, perPage: 6 })
        : null,
      hasPermission(context, 'inventory.view') ? listLowStock(context, 5) : null,
    ]);

  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: context.timezone })
      .format(new Date()),
  );
  const greetingKey = hour < 12 ? 'greetingMorning' : hour < 18 ? 'greetingAfternoon' : 'greetingEvening';
  const firstName = context.actor.name.split(' ')[0] ?? context.actor.name;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">
            {t(greetingKey, { name: firstName })}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasPermission(context, 'products.create') ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/${params.locale}/dashboard/products/new`}>
                <Plus aria-hidden />
                {t('quickCreateProduct')}
              </Link>
            </Button>
          ) : null}
          {hasPermission(context, 'orders.create') ? (
            <Button asChild variant="primary" size="sm">
              <Link href={`/${params.locale}/dashboard/orders/new`}>
                <Plus aria-hidden />
                {t('quickCreateOrder')}
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <RangeTabs locale={params.locale} current={preset} labels={{
        today: tApp('today'),
        last7: tApp('last7Days'),
        last30: tApp('last30Days'),
        last90: tApp('last90Days'),
      }} />

      {metrics ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('kpi.totalOrders')}
              value={formatNumber(metrics.totalOrders, params.locale)}
              icon={<ShoppingBag />}
              tone="primary"
              trend={
                comparison
                  ? { value: percentChange(metrics.totalOrders, comparison.totalOrders) ?? 0 }
                  : null
              }
            />
            <StatCard
              label={t('kpi.totalSales')}
              value={formatMoneyCompact(metrics.totalSales, context.currency, params.locale)}
              icon={<TrendingUp />}
              tone="success"
              trend={
                comparison
                  ? { value: percentChange(metrics.totalSales, comparison.totalSales) ?? 0 }
                  : null
              }
            />
            <StatCard
              label={t('kpi.deliveryRate')}
              value={
                metrics.deliveryRate === null
                  ? null
                  : formatPercent(metrics.deliveryRate, params.locale)
              }
              definition={tAnalytics('definitionText.deliveryRate')}
              hint={
                metrics.deliveryRate === null
                  ? tAnalytics('noData')
                  : `${formatNumber(metrics.deliveredOrders, params.locale)} / ${formatNumber(metrics.shippedEligible, params.locale)}`
              }
              icon={<Truck />}
              tone="info"
            />
            <StatCard
              label={t('kpi.dailyAverage')}
              value={metrics.averageDaily.toFixed(1)}
              icon={<Clock />}
              tone="accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('kpi.pendingOrders')}
              value={formatNumber(metrics.statusCounts.NEW, params.locale)}
              tone="warning"
            />
            <StatCard
              label={t('kpi.confirmedOrders')}
              value={formatNumber(metrics.statusCounts.CONFIRMED, params.locale)}
              tone="primary"
            />
            <StatCard
              label={t('kpi.averageOrderValue')}
              value={
                metrics.averageOrderValue === null
                  ? null
                  : formatMoneyCompact(metrics.averageOrderValue, context.currency, params.locale)
              }
              definition={tAnalytics('definitionText.averageOrderValue')}
            />
            <StatCard
              label={t('kpi.newCustomers')}
              value={formatNumber(metrics.newCustomers, params.locale)}
              icon={<CheckCircle2 />}
              tone="success"
            />
          </div>

          {metrics.hasData ? (
            <DashboardCharts
              series={series ?? []}
              statusCounts={metrics.statusCounts}
              topProducts={topProducts ?? []}
              regions={regions ?? []}
              currency={context.currency}
            />
          ) : (
            <Card>
              <EmptyState
                icon={<ShoppingBag />}
                title={t('noDataYet')}
                description={t('noDataHint')}
                action={
                  hasPermission(context, 'products.create') ? (
                    <Button asChild variant="primary" size="sm">
                      <Link href={`/${params.locale}/dashboard/products/new`}>
                        <Plus aria-hidden />
                        {t('quickCreateProduct')}
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          )}
        </>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {recentOrders ? (
          <div className="lg:col-span-2">
            <RecentOrders
              orders={recentOrders.items}
              locale={params.locale}
              currency={context.currency}
              timezone={context.timezone}
            />
          </div>
        ) : null}

        <div className="space-y-3">
          {lowStock && lowStock.length > 0 ? (
            <Card>
              <CardHeader title={getTranslations(params.locale, 'products')('inventory.state.LOW_STOCK')} />
              <CardBody className="space-y-2 p-3">
                {lowStock.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${params.locale}/dashboard/products/${item.id}/edit`}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius)] px-2 py-1.5 text-[13px] transition-colors duration-fast hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-warning">
                      {formatNumber(item.stockQuantity, params.locale)}
                    </span>
                  </Link>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={tApp('quickActions')} />
            <CardBody className="grid grid-cols-2 gap-2 p-3">
              <QuickAction
                href={`/${params.locale}/dashboard/products/new`}
                label={t('quickCreateProduct')}
                icon={<Package className="size-4" aria-hidden />}
                enabled={hasPermission(context, 'products.create')}
              />
              <QuickAction
                href={`/${params.locale}/dashboard/orders/new`}
                label={t('quickCreateOrder')}
                icon={<ShoppingBag className="size-4" aria-hidden />}
                enabled={hasPermission(context, 'orders.create')}
              />
              <QuickAction
                href={`/${params.locale}/dashboard/pages/new`}
                label={t('quickCreatePage')}
                icon={<FileText className="size-4" aria-hidden />}
                enabled={hasPermission(context, 'pages.manage')}
              />
              <QuickAction
                href={`/${params.locale}/dashboard/call-center/agents`}
                label={t('quickInviteAgent')}
                icon={<UserPlus className="size-4" aria-hidden />}
                enabled={hasPermission(context, 'callcenter.manage')}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon,
  enabled,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}) {
  if (!enabled) return null;

  return (
    <Link
      href={href}
      className="flex flex-col items-start gap-1.5 rounded-[var(--radius)] border border-border p-3 text-[13px] text-foreground transition-colors duration-fast hover:border-border-strong hover:bg-surface-2"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  );
}

function RangeTabs({
  locale,
  current,
  labels,
}: {
  locale: string;
  current: string;
  labels: Record<string, string>;
}) {
  const options = ['today', 'last7', 'last30', 'last90'] as const;

  return (
    <div
      className="hide-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0"
      role="tablist"
      aria-label={labels.last30}
    >
      {options.map((option) => (
        <Link
          key={option}
          href={`/${locale}/dashboard?range=${option}`}
          role="tab"
          aria-selected={current === option}
          scroll={false}
          className={
            current === option
              ? 'shrink-0 rounded-[var(--radius)] bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-medium text-primary'
              : 'shrink-0 rounded-[var(--radius)] px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground'
          }
        >
          {labels[option]}
        </Link>
      ))}
    </div>
  );
}
