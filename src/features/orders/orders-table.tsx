'use client';

import Link from 'next/link';
import { AlertTriangle, Download, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { bulkOrderActionAction, exportOrdersAction } from '@/app/actions/orders';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/field';
import { EmptyState, PartialResultNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { Pagination } from '@/components/data-display/pagination';
import { ORDER_STATUSES, type OrderStatus } from '@/features/orders/state-machine';
import { useDebouncedFilter, useUrlFilters } from '@/hooks/use-url-filters';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { RelativeTime } from '@/features/shared/relative-time';
import { formatMoney, formatNumber } from '@/lib/money';
import { formatPhone, isolateLtr } from '@/lib/phone';
import type { OrderFilter } from '@/validators/order';
import type { OrderListItem, OrderListResult } from '@/server/services/order-service';

import { OrderStatusBadge, SourceBadge } from './status-badge';

/**
 * Orders list.
 *
 * The status row scrolls horizontally on a phone rather than wrapping into
 * three lines, which is how the reference handles a long filter row. Selection
 * and bulk actions are only mounted when the merchant can actually use them.
 */
export function OrdersTable({
  result,
  filter,
  locale,
  currency,
  timezone,
  agents,
  providers,
  canChangeStatus,
  canExport,
  canAssign,
}: {
  result: OrderListResult;
  filter: OrderFilter;
  locale: string;
  currency: string;
  timezone: string;
  agents: Array<{ id: string; name: string }>;
  providers: Array<{ id: string; name: string }>;
  canChangeStatus: boolean;
  canExport: boolean;
  canAssign: boolean;
}) {
  const t = useTranslations('orders');
  const tApp = useTranslations('app');
  const { get, setFilters, reset, activeCount, isPending } = useUrlFilters();
  const [search, setSearch] = useDebouncedFilter('search');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [exportOpen, setExportOpen] = useState(false);
  const { toast } = useToast();

  const bulk = useServerAction(bulkOrderActionAction);
  const exportAction = useServerAction(exportOrdersAction);
  const [partial, setPartial] = useState<string | null>(null);

  const activeStatus = get('status');

  const columns: Array<Column<OrderListItem>> = [
    {
      key: 'order',
      header: t('orderNumber'),
      width: '130px',
      render: (order) => (
        <Link
          href={`/${locale}/dashboard/orders/${order.id}`}
          className="flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary"
        >
          {isolateLtr(order.orderNumber)}
          {order.riskFlagged ? (
            <AlertTriangle className="size-3.5 text-warning" aria-label={t('riskFlagged')} />
          ) : null}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: t('customer'),
      render: (order) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">{order.customerName}</p>
          <p className="truncate font-mono text-2xs text-subtle-foreground">
            {isolateLtr(formatPhone(order.customerPhone))}
          </p>
        </div>
      ),
    },
    {
      key: 'location',
      header: tApp('region'),
      width: '140px',
      render: (order) => (
        <span className="truncate text-muted-foreground">
          {[order.state, order.city].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: tApp('status'),
      width: '120px',
      render: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: 'agent',
      header: t('agent'),
      width: '130px',
      render: (order) => (
        <span className="truncate text-muted-foreground">
          {order.agentName ?? <span className="text-subtle-foreground">{t('unassigned')}</span>}
        </span>
      ),
    },
    {
      key: 'total',
      header: tApp('total'),
      numeric: true,
      width: '130px',
      render: (order) => (
        <span className="font-medium">{formatMoney(order.total, currency, locale)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: tApp('createdAt'),
      width: '150px',
      render: (order) => (
        <RelativeTime
          value={order.createdAt}
          locale={locale}
          timezone={timezone}
          className="text-muted-foreground"
        />
      ),
    },
  ];

  const hasFilters = activeCount > 0;

  const applyBulk = async () => {
    if (!bulkStatus || selected.size === 0) return;

    const response = await bulk.run({
      orderIds: [...selected],
      action: 'change_status',
      toStatus: bulkStatus,
    });

    if (!response) {
      if (bulk.error) toast({ title: bulk.error, tone: 'error' });
      return;
    }

    setSelected(new Set());
    setBulkStatus('');

    if (response.failed.length > 0) {
      // A partial result is reported as partial, never as success.
      setPartial(t('bulk.partial', { ok: response.succeeded, total: response.total }));
    } else {
      setPartial(null);
      toast({ title: t('bulk.applied', { count: response.succeeded }), tone: 'success' });
    }
  };

  const runExport = async () => {
    const response = await exportAction.run(filter);
    if (!response) {
      if (exportAction.error) toast({ title: exportAction.error, tone: 'error' });
      return;
    }

    if (response.rowCount === 0) {
      // No silent empty file: say why nothing was produced.
      setExportOpen(true);
      return;
    }

    const blob = new Blob([response.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = response.filename;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: t('export.count', { count: response.rowCount }), tone: 'success' });
  };

  return (
    <Card>
      {/* Status tabs — horizontally scrollable on a phone. */}
      <div className="hide-scrollbar flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
        <StatusTab
          label={tApp('all')}
          active={!activeStatus}
          onClick={() => setFilters({ status: null })}
        />
        {ORDER_STATUSES.map((status) => (
          <StatusTab
            key={status}
            label={t(`status.${status}`)}
            active={activeStatus === status}
            onClick={() => setFilters({ status })}
          />
        ))}
      </div>

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

        <Button
          variant={filtersOpen || hasFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setFiltersOpen((open) => !open)}
          className="lg:hidden"
        >
          <SlidersHorizontal aria-hidden />
          {tApp('filters')}
          {hasFilters ? (
            <span className="rounded-full bg-primary px-1.5 text-2xs text-[var(--primary-foreground)]">
              {activeCount}
            </span>
          ) : null}
        </Button>

        <div
          className={cn(
            'w-full gap-2 lg:flex lg:w-auto lg:flex-1',
            filtersOpen ? 'grid grid-cols-1 sm:grid-cols-2' : 'hidden',
          )}
        >
          <Input
            type="date"
            value={get('from')}
            onChange={(event) => setFilters({ from: event.target.value })}
            aria-label={tApp('from')}
            className="lg:w-36"
          />
          <Input
            type="date"
            value={get('to')}
            onChange={(event) => setFilters({ to: event.target.value })}
            aria-label={tApp('to')}
            className="lg:w-36"
          />

          {agents.length > 0 ? (
            <NativeSelect
              value={get('agentId')}
              onChange={(event) => setFilters({ agentId: event.target.value })}
              aria-label={t('agent')}
              className="lg:w-40"
            >
              <option value="">{t('agent')}</option>
              <option value="none">{t('unassigned')}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}

          {providers.length > 0 ? (
            <NativeSelect
              value={get('providerId')}
              onChange={(event) => setFilters({ providerId: event.target.value })}
              aria-label={t('provider')}
              className="lg:w-40"
            >
              <option value="">{t('provider')}</option>
              <option value="none">{t('unassigned')}</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}

          <NativeSelect
            value={get('source')}
            onChange={(event) => setFilters({ source: event.target.value })}
            aria-label={t('source')}
            className="lg:w-36"
          >
            <option value="">{t('source')}</option>
            <option value="STOREFRONT">{t('sources.STOREFRONT')}</option>
            <option value="LANDING_PAGE">{t('sources.LANDING_PAGE')}</option>
            <option value="MANUAL">{t('sources.MANUAL')}</option>
            <option value="CALL_CENTER">{t('sources.CALL_CENTER')}</option>
          </NativeSelect>
        </div>

        <div className="ms-auto flex items-center gap-2">
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X aria-hidden />
              {tApp('resetFilters')}
            </Button>
          ) : null}

          {canExport ? (
            <Button variant="outline" size="sm" onClick={runExport} loading={exportAction.submitting}>
              <Download aria-hidden />
              {tApp('export')}
            </Button>
          ) : null}
        </div>
      </div>

      {partial ? (
        <div className="px-3 pt-3">
          <PartialResultNotice message={partial} />
        </div>
      ) : null}

      {/* Bulk action bar, only while a selection exists. */}
      {canChangeStatus && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 p-3">
          <span className="text-[13px] font-medium text-foreground">
            {t('bulk.selected', { count: selected.size })}
          </span>

          <NativeSelect
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as OrderStatus | '')}
            aria-label={t('bulk.changeStatus')}
            className="w-44"
          >
            <option value="">{t('changeStatus')}</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </NativeSelect>

          <Button
            variant="primary"
            size="sm"
            disabled={!bulkStatus}
            loading={bulk.submitting}
            onClick={applyBulk}
          >
            {tApp('apply')}
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            {t('bulk.clear')}
          </Button>
        </div>
      ) : null}

      <DataTable
        rows={result.items}
        columns={columns}
        rowKey={(order) => order.id}
        loading={isPending}
        rowClassName={(order) => (order.riskFlagged ? 'bg-[var(--warning-soft)]' : undefined)}
        selection={
          canChangeStatus || canAssign
            ? {
                selectedIds: selected,
                selectAllLabel: tApp('selectAll'),
                onToggle: (id) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  }),
                onToggleAll: (checked) =>
                  setSelected(checked ? new Set(result.items.map((order) => order.id)) : new Set()),
              }
            : undefined
        }
        empty={
          hasFilters ? (
            <EmptyState
              icon={<Search />}
              title={t('emptyFiltered')}
              description={t('emptyFilteredHint')}
              action={
                <Button variant="outline" size="sm" onClick={reset}>
                  {tApp('resetFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ShoppingBag />}
              title={t('empty')}
              description={t('emptyDescription')}
            />
          )
        }
        mobile={(order) => (
          <Link href={`/${locale}/dashboard/orders/${order.id}`} className="block px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    {isolateLtr(order.orderNumber)}
                  </span>
                  {order.riskFlagged ? (
                    <AlertTriangle className="size-3.5 text-warning" aria-label={t('riskFlagged')} />
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[13px] font-medium text-foreground">
                  {order.customerName}
                </p>
                <p className="truncate font-mono text-2xs text-subtle-foreground">
                  {isolateLtr(formatPhone(order.customerPhone))}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[13px] font-medium tabular-nums text-foreground">
                  {formatMoney(order.total, currency, locale)}
                </p>
                <RelativeTime
                  value={order.createdAt}
                  locale={locale}
                  timezone={timezone}
                  className="mt-0.5 block text-2xs text-subtle-foreground"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <OrderStatusBadge status={order.status} />
              <SourceBadge source={order.source} />
              {order.city ? (
                <span className="text-2xs text-subtle-foreground">{order.city}</span>
              ) : null}
              <span className="text-2xs text-subtle-foreground">
                {t('itemsCount', { count: formatNumber(order.itemCount, locale) })}
              </span>
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

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent
          size="sm"
          title={t('export.title')}
          footer={
            <Button variant="secondary" onClick={() => setExportOpen(false)}>
              {tApp('close')}
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">{t('export.noRows')}</p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatusTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-[var(--radius)] px-2.5 py-1.5 text-xs transition-colors duration-fast',
        active
          ? 'bg-[var(--primary-soft)] font-medium text-primary'
          : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
