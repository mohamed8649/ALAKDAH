'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/i18n/provider';
import { formatNumber } from '@/lib/money';
import { useLocale } from '@/i18n/provider';

/**
 * Server-side pagination controls.
 *
 * The page number lives in the URL, so refresh, back and a shared link all land
 * on the same page. Chevrons mirror with the document direction.
 */
export function Pagination({
  page,
  pageCount,
  total,
  perPage,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations('app');
  const locale = useLocale();

  if (total === 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {t('showing', {
          from: formatNumber(from, locale),
          to: formatNumber(to, locale),
          total: formatNumber(total, locale),
        })}
      </p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronRight className="rtl-flip" aria-hidden />
            {t('previous')}
          </Button>

          <span className="px-2 text-xs tabular-nums text-muted-foreground">
            {formatNumber(page, locale)} / {formatNumber(pageCount, locale)}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            {t('next')}
            <ChevronLeft className="rtl-flip" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
