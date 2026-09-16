'use client';

import { ArrowDownRight, ArrowUpRight, HelpCircle, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Tooltip } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/states';
import { cn } from '@/lib/cn';

/**
 * KPI tile.
 *
 * A metric with no data shows a dash and its definition, not a zero. A merchant
 * seeing "0%" next to "delivery rate" concludes their business is failing; "—"
 * with "no shipped orders in this period" tells them the truth.
 */
export function StatCard({
  label,
  value,
  hint,
  definition,
  trend,
  icon,
  tone = 'neutral',
  loading,
  emptyLabel = '—',
  className,
}: {
  label: string;
  value: string | number | null;
  hint?: string;
  /** Explains how the metric is computed. Rendered in a tooltip. */
  definition?: string;
  trend?: { value: number; label?: string } | null;
  icon?: ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  loading?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-border bg-surface-1 p-3.5 shadow-card sm:p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          {definition ? (
            <Tooltip content={definition}>
              <button
                type="button"
                aria-label={`تعريف ${label}`}
                className="shrink-0 text-subtle-foreground transition-colors duration-fast hover:text-foreground"
              >
                <HelpCircle className="size-3.5" aria-hidden />
              </button>
            </Tooltip>
          ) : null}
        </div>
        {icon ? (
          <span className={cn('shrink-0 [&_svg]:size-4', TONE_ICON[tone])} aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="mt-2.5 h-7 w-2/3" />
      ) : (
        <p
          className={cn(
            'mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl',
            hasValue ? 'text-foreground' : 'text-subtle-foreground',
          )}
        >
          {hasValue ? value : emptyLabel}
        </p>
      )}

      <div className="mt-1 flex items-center gap-2">
        {trend && hasValue ? <TrendIndicator trend={trend} /> : null}
        {hint ? <p className="truncate text-2xs text-subtle-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: { value: number; label?: string } }) {
  const direction = trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'flat';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-2xs font-medium tabular-nums',
        direction === 'up' && 'text-success',
        direction === 'down' && 'text-danger',
        direction === 'flat' && 'text-subtle-foreground',
      )}
    >
      <Icon className="rtl-flip size-3" aria-hidden />
      {Math.abs(trend.value).toFixed(1)}%
      {trend.label ? <span className="text-subtle-foreground">{trend.label}</span> : null}
    </span>
  );
}

const TONE_ICON = {
  neutral: 'text-subtle-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  accent: 'text-accent',
} as const;
