'use client';

import { useId, useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { useDirection, useLocale } from '@/i18n/provider';
import { formatNumber } from '@/lib/money';

/**
 * Charts.
 *
 * Hand-rolled SVG rather than a charting library: these are four simple shapes,
 * the bundle stays small, and RTL handling is explicit instead of fought with.
 *
 * Accessibility: every chart also renders its data as a visually-hidden table,
 * so a screen reader gets the numbers rather than "graphic".
 */

export interface SeriesPoint {
  key: string;
  label: string;
  value: number;
}

function VisuallyHiddenTable({
  caption,
  data,
  valueLabel,
  locale,
}: {
  caption: string;
  data: readonly SeriesPoint[];
  valueLabel: string;
  locale: string;
}) {
  return (
    // The `sr-only` class goes on a wrapping div, not on the table itself.
    // `sr-only` works by pinning the element to 1×1 with overflow hidden, and a
    // table treats a 1px width as a hint rather than a limit — it expands to its
    // content regardless, which quietly widened the dashboard by the width of
    // this invisible table.
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{valueLabel}</th>
            <th scope="col">{caption}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.label}</th>
              <td>{formatNumber(point.value, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Area / line chart
// ---------------------------------------------------------------------------

export function AreaChart({
  data,
  title,
  valueLabel,
  height = 200,
  formatValue,
  color = 'var(--primary)',
  className,
}: {
  data: readonly SeriesPoint[];
  title: string;
  valueLabel: string;
  height?: number;
  formatValue?: (value: number) => string;
  color?: string;
  className?: string;
}) {
  const gradientId = useId();
  const locale = useLocale();
  const dir = useDirection();
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (data.length === 0) return null;

    const width = 600;
    const padding = { top: 12, bottom: 24, x: 8 };
    const innerHeight = height - padding.top - padding.bottom;
    const max = Math.max(...data.map((point) => point.value), 1);
    const step = data.length > 1 ? (width - padding.x * 2) / (data.length - 1) : 0;

    const points = data.map((point, index) => {
      // In RTL the time axis runs right to left, matching how the labels read.
      const rawX = padding.x + index * step;
      const x = dir === 'rtl' ? width - rawX : rawX;
      const y = padding.top + innerHeight - (point.value / max) * innerHeight;
      return { x, y, point };
    });

    const ordered = dir === 'rtl' ? [...points].reverse() : points;
    const line = ordered.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const area = `${line} L${last.x.toFixed(1)},${height - padding.bottom} L${first.x.toFixed(1)},${height - padding.bottom} Z`;

    return { width, points, line, area, max, baseline: height - padding.bottom, top: padding.top };
  }, [data, height, dir]);

  if (!geometry) return null;

  const active = hover !== null ? geometry.points[hover] : null;

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${geometry.width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={title}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = geometry.top + (geometry.baseline - geometry.top) * ratio;
          return (
            <line
              key={ratio}
              x1="0"
              x2={geometry.width}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={ratio === 1 ? undefined : '3 4'}
            />
          );
        })}

        <path d={geometry.area} fill={`url(#${gradientId})`} />
        <path
          d={geometry.line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {active ? (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={geometry.top}
              y2={geometry.baseline}
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
            <circle cx={active.x} cy={active.y} r="4" fill={color} stroke="var(--surface-1)" strokeWidth="2" />
          </>
        ) : null}

        {geometry.points.map((p, index) => (
          <rect
            key={p.point.key}
            x={p.x - geometry.width / (data.length * 2)}
            y={0}
            width={geometry.width / data.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute top-1 rounded-[var(--radius)] border border-border bg-surface-elevated px-2 py-1 text-xs shadow-overlay"
          style={{
            insetInlineStart: `${(dir === 'rtl' ? geometry.width - active.x : active.x) / geometry.width * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="block text-subtle-foreground">{active.point.label}</span>
          <span className="block font-medium tabular-nums text-foreground">
            {formatValue ? formatValue(active.point.value) : formatNumber(active.point.value, locale)}
          </span>
        </div>
      ) : null}

      <div className="mt-1 flex justify-between text-2xs text-subtle-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>

      <VisuallyHiddenTable caption={title} data={data} valueLabel={valueLabel} locale={locale} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar chart
// ---------------------------------------------------------------------------

export function BarList({
  data,
  title,
  valueLabel,
  formatValue,
  maxItems = 6,
  color = 'var(--primary)',
  className,
}: {
  data: readonly SeriesPoint[];
  title: string;
  valueLabel: string;
  formatValue?: (value: number) => string;
  maxItems?: number;
  color?: string;
  className?: string;
}) {
  const locale = useLocale();
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className={cn('space-y-2.5', className)}>
      {items.map((item) => (
        <div key={item.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-foreground">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatValue ? formatValue(item.value) : formatNumber(item.value, locale)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-slow"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}

      <VisuallyHiddenTable caption={title} data={items} valueLabel={valueLabel} locale={locale} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut chart
// ---------------------------------------------------------------------------

export interface DonutSlice extends SeriesPoint {
  color: string;
}

export function DonutChart({
  data,
  title,
  valueLabel,
  centerLabel,
  centerValue,
  size = 148,
  className,
}: {
  data: readonly DonutSlice[];
  title: string;
  valueLabel: string;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  className?: string;
}) {
  const locale = useLocale();
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  const segments = useMemo(() => {
    if (total === 0) return [];
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return data
      .filter((slice) => slice.value > 0)
      .map((slice) => {
        const fraction = slice.value / total;
        const length = fraction * circumference;
        const segment = {
          ...slice,
          dashArray: `${length} ${circumference - length}`,
          dashOffset: -offset,
          percent: fraction * 100,
        };
        offset += length;
        return segment;
      });
  }, [data, total]);

  return (
    <div className={cn('flex flex-wrap items-center gap-5', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 128 128" className="size-full -rotate-90" role="img" aria-label={title}>
          <circle cx="64" cy="64" r="54" fill="none" stroke="var(--surface-3)" strokeWidth="14" />
          {segments.map((segment) => (
            <circle
              key={segment.key}
              cx="64"
              cy="64"
              r="54"
              fill="none"
              stroke={segment.color}
              strokeWidth="14"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {centerValue ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold tabular-nums text-foreground">{centerValue}</span>
            {centerLabel ? (
              <span className="text-2xs text-subtle-foreground">{centerLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {data
          .filter((slice) => slice.value > 0)
          .map((slice) => (
            <li key={slice.key} className="flex items-center gap-2 text-xs">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: slice.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{slice.label}</span>
              <span className="shrink-0 tabular-nums text-foreground">
                {formatNumber(slice.value, locale)}
              </span>
              <span className="w-10 shrink-0 text-end tabular-nums text-subtle-foreground">
                {total > 0 ? `${Math.round((slice.value / total) * 100)}%` : '—'}
              </span>
            </li>
          ))}
      </ul>

      <VisuallyHiddenTable caption={title} data={data} valueLabel={valueLabel} locale={locale} />
    </div>
  );
}
