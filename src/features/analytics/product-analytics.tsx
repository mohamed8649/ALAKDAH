'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';

import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, PartialResultNotice } from '@/components/ui/states';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { DateRangeTabs } from '@/features/analytics/date-range-tabs';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatMoney, formatNumber, formatPercent } from '@/lib/money';
import type { ProductAnalyticsRow } from '@/server/services/analytics-service';

/**
 * Product analytics.
 *
 * Conversion is only shown for products with enough view events to make the
 * ratio meaningful; below the threshold the cell is a dash and a notice
 * explains why, rather than displaying a number a merchant might act on.
 */
export function ProductAnalyticsView({
  rows,
  totalViews,
  hasEnoughEvents,
  preset,
  locale,
  currency,
}: {
  rows: ProductAnalyticsRow[];
  totalViews: number;
  hasEnoughEvents: boolean;
  preset: string;
  locale: string;
  currency: string;
}) {
  const t = useTranslations('analytics');
  const tProducts = useTranslations('products');
  const currentLocale = useLocale();

  const columns: Array<Column<ProductAnalyticsRow>> = [
    {
      key: 'name',
      header: tProducts('fields.name'),
      render: (row) => (
        <Link
          href={`/${locale}/dashboard/products/${row.productId}/edit`}
          className="truncate font-medium text-foreground hover:text-primary"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'views',
      header: t('metrics.views'),
      numeric: true,
      width: '100px',
      render: (row) => <span className="tabular-nums">{formatNumber(row.views, currentLocale)}</span>,
    },
    {
      key: 'orders',
      header: t('metrics.totalOrders'),
      numeric: true,
      width: '100px',
      render: (row) => <span className="tabular-nums">{formatNumber(row.orders, currentLocale)}</span>,
    },
    {
      key: 'units',
      header: t('metrics.unitsSold'),
      numeric: true,
      width: '110px',
      render: (row) => (
        <span className="tabular-nums">{formatNumber(row.unitsSold, currentLocale)}</span>
      ),
    },
    {
      key: 'revenue',
      header: t('metrics.revenue'),
      numeric: true,
      width: '140px',
      render: (row) => (
        <span className="font-medium tabular-nums">
          {formatMoney(row.revenue, currency, currentLocale)}
        </span>
      ),
    },
    {
      key: 'conversion',
      header: t('metrics.conversion'),
      numeric: true,
      width: '110px',
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {row.conversion === null ? '—' : formatPercent(row.conversion, currentLocale)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <DateRangeTabs preset={preset} />

      {!hasEnoughEvents && rows.length > 0 ? (
        <div className="mb-3">
          <PartialResultNotice message={t('insufficientEvents')} />
        </div>
      ) : null}

      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.productId}
          empty={
            <EmptyState icon={<Package />} title={t('noData')} description={t('noDataHint')} />
          }
          mobile={(row) => (
            <Link
              href={`/${locale}/dashboard/products/${row.productId}/edit`}
              className="block px-4 py-3"
            >
              <p className="truncate text-[13px] font-medium text-foreground">{row.name}</p>
              <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-2xs">
                <div className="flex gap-1">
                  <dt className="text-subtle-foreground">{t('metrics.views')}</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatNumber(row.views, currentLocale)}
                  </dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-subtle-foreground">{t('metrics.unitsSold')}</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatNumber(row.unitsSold, currentLocale)}
                  </dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-subtle-foreground">{t('metrics.revenue')}</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatMoney(row.revenue, currency, currentLocale)}
                  </dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-subtle-foreground">{t('metrics.conversion')}</dt>
                  <dd className="tabular-nums text-foreground">
                    {row.conversion === null ? '—' : formatPercent(row.conversion, currentLocale)}
                  </dd>
                </div>
              </dl>
            </Link>
          )}
        />

        <CardBody className="border-t border-border py-2.5">
          <p className="text-2xs text-subtle-foreground">
            {t('definitionText.conversion')} — {t('metrics.views')}:{' '}
            {formatNumber(totalViews, currentLocale)}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
