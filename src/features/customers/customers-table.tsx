'use client';

import Link from 'next/link';
import { Search, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/states';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { Pagination } from '@/components/data-display/pagination';
import { useDebouncedFilter, useUrlFilters } from '@/hooks/use-url-filters';
import { useTranslations } from '@/i18n/provider';
import { formatRelative } from '@/lib/datetime';
import { formatMoney, formatNumber } from '@/lib/money';
import { formatPhone, isolateLtr } from '@/lib/phone';

interface Row {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  isBlocked: boolean;
  tags: string[];
  createdAt: string;
}

export function CustomersTable({
  result,
  locale,
  currency,
  country,
}: {
  result: { items: Row[]; total: number; page: number; perPage: number; pageCount: number };
  locale: string;
  currency: string;
  country: string;
}) {
  const t = useTranslations('customers');
  const tApp = useTranslations('app');
  const { get, setFilters, isPending, activeCount } = useUrlFilters();
  const [search, setSearch] = useDebouncedFilter('search');

  const columns: Array<Column<Row>> = [
    {
      key: 'name',
      header: tApp('name'),
      render: (customer) => (
        <Link
          href={`/${locale}/dashboard/customers/${customer.id}`}
          className="font-medium text-foreground hover:text-primary"
        >
          {customer.name}
          {customer.isBlocked ? (
            <Badge tone="danger" className="ms-2">
              {t('blocked')}
            </Badge>
          ) : null}
        </Link>
      ),
    },
    {
      key: 'phone',
      header: tApp('phone'),
      width: '150px',
      render: (customer) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {formatPhone(customer.phone, country)}
        </span>
      ),
    },
    {
      key: 'orders',
      header: t('ordersCount'),
      numeric: true,
      width: '100px',
      render: (customer) => (
        <span className="tabular-nums">{formatNumber(customer.ordersCount, locale)}</span>
      ),
    },
    {
      key: 'spent',
      header: t('totalSpent'),
      numeric: true,
      width: '140px',
      render: (customer) => (
        <span className="font-medium tabular-nums">
          {formatMoney(customer.totalSpent, currency, locale)}
        </span>
      ),
    },
    {
      key: 'lastOrder',
      header: t('lastOrder'),
      width: '140px',
      render: (customer) => (
        <span className="text-muted-foreground">
          {customer.lastOrderAt ? formatRelative(customer.lastOrderAt, locale) : '—'}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute inset-inline-start-0 start-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="ps-8"
          />
        </div>

        <NativeSelect
          value={get('sort') || 'newest'}
          onChange={(event) => setFilters({ sort: event.target.value })}
          aria-label={tApp('sortBy')}
          className="sm:w-44"
        >
          <option value="newest">{tApp('newest')}</option>
          <option value="spent">{t('totalSpent')}</option>
          <option value="orders">{t('ordersCount')}</option>
        </NativeSelect>
      </div>

      <DataTable
        rows={result.items}
        columns={columns}
        rowKey={(customer) => customer.id}
        loading={isPending}
        empty={
          activeCount > 0 ? (
            <EmptyState icon={<Search />} title={tApp('noResults')} />
          ) : (
            <EmptyState icon={<Users />} title={t('empty')} description={t('emptyDescription')} />
          )
        }
        mobile={(customer) => (
          <Link href={`/${locale}/dashboard/customers/${customer.id}`} className="block px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">{customer.name}</p>
                <p className="truncate font-mono text-2xs text-subtle-foreground" dir="ltr">
                  {isolateLtr(formatPhone(customer.phone, country))}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[13px] font-medium tabular-nums text-foreground">
                  {formatMoney(customer.totalSpent, currency, locale)}
                </p>
                <p className="text-2xs text-subtle-foreground">
                  {formatNumber(customer.ordersCount, locale)} {t('ordersCount')}
                </p>
              </div>
            </div>
          </Link>
        )}
      />

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        perPage={result.perPage}
        onPageChange={(page) => setFilters({ page }, { keepPage: true })}
      />
    </Card>
  );
}
