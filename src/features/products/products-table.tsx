'use client';

import Link from 'next/link';
import { MoreHorizontal, Package, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { Pagination } from '@/components/data-display/pagination';
import { archiveProductAction } from '@/app/actions/products';
import { useDebouncedFilter, useUrlFilters } from '@/hooks/use-url-filters';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatMoney, formatNumber } from '@/lib/money';
import { cn } from '@/lib/cn';

import { StockBadge } from './stock-badge';
import type { ProductListItem, ProductListResult } from '@/server/services/product-service';

/**
 * Products list.
 *
 * Filters live in the URL, so a merchant can bookmark "out of stock, active"
 * and come back to it. Below md the table becomes a card list — a seven-column
 * grid on a phone is not usable.
 */
export function ProductsTable({
  result,
  locale,
  currency,
  canEdit,
  canDelete,
  canAdjustStock,
}: {
  result: ProductListResult;
  locale: string;
  currency: string;
  canEdit: boolean;
  canDelete: boolean;
  canAdjustStock: boolean;
}) {
  const t = useTranslations('products');
  const tApp = useTranslations('app');
  const { get, setFilters, reset, activeCount, isPending } = useUrlFilters();
  const [search, setSearch] = useDebouncedFilter('search');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProductListItem | null>(null);
  const { toast } = useToast();
  const archive = useServerAction(archiveProductAction);

  const columns: Array<Column<ProductListItem>> = [
    {
      key: 'name',
      header: t('fields.name'),
      render: (product) => (
        <div className="flex items-center gap-2.5">
          <ProductThumb url={product.imageUrl} />
          <div className="min-w-0">
            <Link
              href={`/${locale}/dashboard/products/${product.id}/edit`}
              className="block truncate font-medium text-foreground hover:text-primary"
            >
              {product.name}
            </Link>
            {product.sku ? (
              <span className="block truncate font-mono text-2xs text-subtle-foreground">
                {product.sku}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('fields.status'),
      width: '110px',
      render: (product) => (
        <Badge tone={product.status === 'ACTIVE' ? 'success' : product.status === 'DRAFT' ? 'neutral' : 'warning'}>
          {t(`status.${product.status}`)}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: t('fields.price'),
      numeric: true,
      width: '130px',
      render: (product) => (
        <span className="font-medium">{formatMoney(product.price, currency, locale)}</span>
      ),
    },
    {
      key: 'stock',
      header: t('inventory.title'),
      width: '140px',
      render: (product) => <StockBadge product={product} locale={locale} />,
    },
    {
      key: 'variants',
      header: t('variants.title'),
      numeric: true,
      width: '90px',
      render: (product) =>
        product.hasVariants ? (
          <span className="tabular-nums text-muted-foreground">
            {formatNumber(product.variantCount, locale)}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{tApp('actions')}</span>,
      width: '48px',
      render: (product) => (
        <RowActions
          product={product}
          locale={locale}
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={() => setPendingDelete(product)}
        />
      ),
    },
  ];

  const hasFilters = activeCount > 0;

  return (
    <Card>
      {/* Filter bar */}
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
          className="sm:hidden"
        >
          <SlidersHorizontal aria-hidden />
          {tApp('filters')}
          {hasFilters ? (
            <span className="rounded-full bg-primary px-1.5 text-2xs text-[var(--primary-foreground)]">
              {activeCount}
            </span>
          ) : null}
        </Button>

        <div className={cn('w-full gap-2 sm:flex sm:w-auto', filtersOpen ? 'grid grid-cols-2' : 'hidden')}>
          <NativeSelect
            value={get('status')}
            onChange={(event) => setFilters({ status: event.target.value })}
            aria-label={t('fields.status')}
            className="sm:w-36"
          >
            <option value="">{tApp('all')}</option>
            <option value="ACTIVE">{t('status.ACTIVE')}</option>
            <option value="DRAFT">{t('status.DRAFT')}</option>
            <option value="ARCHIVED">{t('status.ARCHIVED')}</option>
          </NativeSelect>

          <NativeSelect
            value={get('stock')}
            onChange={(event) => setFilters({ stock: event.target.value })}
            aria-label={t('inventory.title')}
            className="sm:w-40"
          >
            <option value="">{tApp('all')}</option>
            <option value="IN_STOCK">{t('inventory.state.IN_STOCK')}</option>
            <option value="LOW_STOCK">{t('inventory.state.LOW_STOCK')}</option>
            <option value="OUT_OF_STOCK">{t('inventory.state.OUT_OF_STOCK')}</option>
          </NativeSelect>

          <NativeSelect
            value={get('sort') || 'newest'}
            onChange={(event) => setFilters({ sort: event.target.value })}
            aria-label={tApp('sortBy')}
            className="sm:w-36"
          >
            <option value="newest">{tApp('newest')}</option>
            <option value="oldest">{tApp('oldest')}</option>
            <option value="name">{tApp('name')}</option>
            <option value="price_asc">{t('fields.price')} ↑</option>
            <option value="price_desc">{t('fields.price')} ↓</option>
          </NativeSelect>
        </div>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X aria-hidden />
            {tApp('resetFilters')}
          </Button>
        ) : null}
      </div>

      <DataTable
        rows={result.items}
        columns={columns}
        rowKey={(product) => product.id}
        loading={isPending}
        empty={
          hasFilters ? (
            <EmptyState
              icon={<Search />}
              title={t('emptyFiltered')}
              action={
                <Button variant="outline" size="sm" onClick={reset}>
                  {tApp('resetFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Package />}
              title={t('empty')}
              description={t('emptyDescription')}
              action={
                canEdit ? (
                  <Button asChild variant="primary" size="sm">
                    <Link href={`/${locale}/dashboard/products/new`}>
                      <Plus aria-hidden />
                      {t('emptyCta')}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
        }
        mobile={(product) => (
          <Link
            href={`/${locale}/dashboard/products/${product.id}/edit`}
            className="flex items-start gap-3 px-4 py-3"
          >
            <ProductThumb url={product.imageUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{product.name}</p>
              <p className="mt-0.5 text-[13px] font-medium tabular-nums text-foreground">
                {formatMoney(product.price, currency, locale)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge
                  tone={product.status === 'ACTIVE' ? 'success' : product.status === 'DRAFT' ? 'neutral' : 'warning'}
                >
                  {t(`status.${product.status}`)}
                </Badge>
                <StockBadge product={product} locale={locale} />
                {product.hasVariants ? (
                  <Badge tone="outline">{t('variants.count', { count: product.variantCount })}</Badge>
                ) : null}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('deleteConfirm')}
        description={t('deleteWarning')}
        confirmLabel={tApp('delete')}
        cancelLabel={tApp('cancel')}
        loading={archive.submitting}
        onConfirm={async () => {
          if (!pendingDelete) return;
          const result = await archive.run(pendingDelete.id);
          setPendingDelete(null);
          if (result !== null) toast({ title: t('archived'), tone: 'success' });
          else if (archive.error) toast({ title: archive.error, tone: 'error' });
        }}
      />

      {canAdjustStock ? null : null}
    </Card>
  );
}

function ProductThumb({ url, size = 'md' }: { url: string | null; size?: 'md' | 'lg' }) {
  const dimension = size === 'lg' ? 'size-12' : 'size-8';

  if (!url) {
    return (
      <span
        className={cn(
          dimension,
          'flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-3 text-subtle-foreground',
        )}
        aria-hidden
      >
        <Package className="size-4" />
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- merchant uploads are arbitrary paths
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn(dimension, 'shrink-0 rounded-[var(--radius-sm)] object-cover')}
    />
  );
}

function RowActions({
  product,
  locale,
  canEdit,
  canDelete,
  onDelete,
}: {
  product: ProductListItem;
  locale: string;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const tApp = useTranslations('app');

  if (!canEdit && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          label={tApp('actions')}
          icon={<MoreHorizontal />}
          size="sm"
          onClick={(event) => event.stopPropagation()}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit ? (
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/dashboard/products/${product.id}/edit`}>
              <Pencil />
              {tApp('edit')}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem tone="danger" onSelect={onDelete}>
            <Trash2 />
            {tApp('delete')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
