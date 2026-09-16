/**
 * Timezone-aware date handling.
 *
 * Timestamps are stored as UTC and rendered in the store's timezone (default
 * Africa/Tripoli). Date-range filters and campaign windows are resolved against
 * the store timezone on the server, never against the browser clock — a device
 * with the wrong date must not shift a merchant's daily report.
 */

export const DEFAULT_TIMEZONE = 'Africa/Tripoli';

export function formatDate(
  value: Date | string,
  locale: string = 'ar',
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(toDate(value));
}

export function formatDateTime(
  value: Date | string,
  locale: string = 'ar',
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value));
}

export function formatTime(
  value: Date | string,
  locale: string = 'ar',
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value));
}

/** "منذ ٣ ساعات" / "3 hours ago". */
export function formatRelative(value: Date | string, locale: string = 'ar'): string {
  const date = toDate(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });

  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.348],
    ['month', 12],
  ];

  let value_ = diffSeconds;
  for (const [unit, limit] of thresholds) {
    if (Math.abs(value_) < limit) return formatter.format(Math.round(value_), unit);
    value_ /= limit;
  }
  return formatter.format(Math.round(value_), 'year');
}

/**
 * Local YYYY-MM-DD for a timestamp in a given timezone. Grouping orders "by
 * day" must use the merchant's day boundary, not UTC midnight.
 */
export function dayKey(value: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(toDate(value));

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/** The UTC offset of a timezone at a given instant, in minutes. */
export function timezoneOffsetMinutes(timezone: string, at: Date = new Date()): number {
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(at.toLocaleString('en-US', { timeZone: timezone }));
  return Math.round((local.getTime() - utc.getTime()) / 60000);
}

/** Start of a local calendar day, as a UTC instant. */
export function startOfDayUtc(dayKeyValue: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const probe = new Date(`${dayKeyValue}T00:00:00Z`);
  const offset = timezoneOffsetMinutes(timezone, probe);
  return new Date(probe.getTime() - offset * 60000);
}

export function endOfDayUtc(dayKeyValue: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const start = startOfDayUtc(dayKeyValue, timezone);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'month' | 'custom';

export interface ResolvedRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
  fromKey: string;
  toKey: string;
}

/**
 * Turn a preset (or explicit from/to day keys) into a UTC instant range
 * anchored to the store timezone.
 */
export function resolveDateRange(
  preset: DateRangePreset,
  timezone: string = DEFAULT_TIMEZONE,
  custom?: { from?: string; to?: string },
): ResolvedRange {
  const todayKey = dayKey(new Date(), timezone);

  if (preset === 'custom' && custom?.from) {
    const toKey = custom.to ?? todayKey;
    return {
      from: startOfDayUtc(custom.from, timezone),
      to: endOfDayUtc(toKey, timezone),
      preset: 'custom',
      fromKey: custom.from,
      toKey,
    };
  }

  const days = { today: 0, yesterday: 1, last7: 6, last30: 29, last90: 89, month: 0, custom: 0 }[preset];
  const fromKey =
    preset === 'month'
      ? `${todayKey.slice(0, 7)}-01`
      : shiftDayKey(todayKey, -days);
  const toKey = preset === 'yesterday' ? shiftDayKey(todayKey, -1) : todayKey;

  return {
    from: startOfDayUtc(fromKey, timezone),
    to: endOfDayUtc(toKey, timezone),
    preset,
    fromKey,
    toKey,
  };
}

export function shiftDayKey(key: string, deltaDays: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/** Every day key in a range, inclusive — used to fill chart gaps with zeros. */
export function enumerateDays(fromKey: string, toKey: string, max = 400): string[] {
  const keys: string[] = [];
  let cursor = fromKey;
  while (cursor <= toKey && keys.length < max) {
    keys.push(cursor);
    cursor = shiftDayKey(cursor, 1);
  }
  return keys;
}

export function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T12:00:00Z`).getTime();
  const to = new Date(`${toKey}T12:00:00Z`).getTime();
  return Math.max(1, Math.round((to - from) / (24 * 60 * 60 * 1000)) + 1);
}

/** Short axis label, e.g. "١٢ أكتوبر" / "12 Oct". */
export function formatDayLabel(key: string, locale: string = 'ar'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${key}T12:00:00Z`));
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function intlLocale(locale: string): string {
  // Latin digits in Arabic output: totals and order numbers read faster, and
  // mixed Arabic/Latin lines stay predictable under the bidi algorithm.
  return locale === 'ar' ? 'ar-LY-u-nu-latn' : 'en-GB';
}
