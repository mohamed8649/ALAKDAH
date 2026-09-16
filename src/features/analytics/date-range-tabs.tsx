'use client';

import { Input } from '@/components/ui/field';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/**
 * Date range selector.
 *
 * The range lives in the URL, so a merchant can bookmark "last 90 days" and
 * share a report link that opens on the same window. Presets cover the common
 * cases; custom dates are there when a merchant needs an exact period.
 */
export function DateRangeTabs({ preset }: { preset: string }) {
  const t = useTranslations('app');
  const { get, setFilters } = useUrlFilters();

  const options = [
    { key: 'today', label: t('today') },
    { key: 'last7', label: t('last7Days') },
    { key: 'last30', label: t('last30Days') },
    { key: 'last90', label: t('last90Days') },
    { key: 'month', label: t('thisMonth') },
  ];

  const isCustom = preset === 'custom';

  return (
    <div className="mb-4 space-y-2">
      <div className="hide-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={preset === option.key}
            onClick={() => setFilters({ range: option.key, from: null, to: null })}
            className={cn(
              'shrink-0 rounded-[var(--radius)] px-3 py-1.5 text-xs transition-colors duration-fast',
              preset === option.key
                ? 'bg-[var(--primary-soft)] font-medium text-primary'
                : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}

        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() => setFilters({ range: 'custom' })}
          className={cn(
            'shrink-0 rounded-[var(--radius)] px-3 py-1.5 text-xs transition-colors duration-fast',
            isCustom
              ? 'bg-[var(--primary-soft)] font-medium text-primary'
              : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
          )}
        >
          {t('custom')}
        </button>
      </div>

      {isCustom ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={get('from')}
            onChange={(event) => setFilters({ from: event.target.value, range: 'custom' })}
            aria-label={t('from')}
            className="w-40"
          />
          <span className="text-xs text-subtle-foreground">—</span>
          <Input
            type="date"
            value={get('to')}
            onChange={(event) => setFilters({ to: event.target.value, range: 'custom' })}
            aria-label={t('to')}
            className="w-40"
          />
        </div>
      ) : null}
    </div>
  );
}
