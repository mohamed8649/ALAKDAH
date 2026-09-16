'use client';

import { useTranslations } from '@/i18n/provider';
import { formatDateTime } from '@/lib/datetime';
import { cn } from '@/lib/cn';

import { statusTone, type OrderStatus } from './state-machine';

/**
 * Status history.
 *
 * Every transition, who made it and why. This is the operational record a
 * merchant uses to answer "why was this cancelled?" — so a reason, when one was
 * given, is always shown.
 */
export function OrderTimeline({
  history,
  locale,
  timezone,
}: {
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorName: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  locale: string;
  timezone: string;
}) {
  const t = useTranslations('orders.status');
  const tAudit = useTranslations('audit');

  if (history.length === 0) {
    return <p className="text-xs text-subtle-foreground">—</p>;
  }

  return (
    <ol className="relative space-y-4">
      {history.map((entry, index) => {
        const tone = statusTone(entry.toStatus as OrderStatus);
        const last = index === history.length - 1;

        return (
          <li key={entry.id} className="relative flex gap-3 ps-1">
            {/* Connector between markers; omitted on the final entry. */}
            {!last ? (
              <span
                className="absolute inset-inline-start-0 start-[7px] top-4 h-[calc(100%+0.5rem)] w-px bg-border"
                aria-hidden
              />
            ) : null}

            <span
              className={cn(
                'relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2 border-[var(--surface-1)]',
                TONE_BG[tone],
              )}
              aria-hidden
            />

            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-[13px] text-foreground">
                {entry.fromStatus ? (
                  <>
                    <span className="text-muted-foreground">{t(entry.fromStatus)}</span>
                    <span className="mx-1.5 text-subtle-foreground" aria-hidden>
                      ←
                    </span>
                  </>
                ) : null}
                <span className="font-medium">{t(entry.toStatus)}</span>
              </p>

              <p className="mt-0.5 text-2xs text-subtle-foreground">
                {formatDateTime(entry.createdAt, locale, timezone)}
                {' · '}
                {entry.actorName ?? tAudit('system')}
              </p>

              {entry.reason ? (
                <p className="mt-1 rounded-[var(--radius-sm)] bg-surface-2 px-2 py-1 text-xs text-muted-foreground">
                  {entry.reason}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const TONE_BG: Record<string, string> = {
  neutral: 'bg-[var(--muted-foreground)]',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
  outline: 'bg-border-strong',
};
