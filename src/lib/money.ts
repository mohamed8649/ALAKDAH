/**
 * Money handling.
 *
 * Every monetary value in the database is an integer count of MINOR UNITS.
 * LYD has three minor digits, so 235.000 LYD is stored as the integer 235000.
 * JavaScript floats never touch a stored amount; parsing and formatting are the
 * only two places a decimal string exists.
 */

export const CURRENCIES = {
  LYD: { code: 'LYD', minorDigits: 3, symbolAr: 'د.ل', symbolEn: 'LYD' },
  USD: { code: 'USD', minorDigits: 2, symbolAr: '$', symbolEn: '$' },
  EUR: { code: 'EUR', minorDigits: 2, symbolAr: '€', symbolEn: '€' },
  TND: { code: 'TND', minorDigits: 3, symbolAr: 'د.ت', symbolEn: 'TND' },
  EGP: { code: 'EGP', minorDigits: 2, symbolAr: 'ج.م', symbolEn: 'EGP' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_CURRENCY: CurrencyCode = 'LYD';

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function minorDigits(currency: string): number {
  return isCurrencyCode(currency) ? CURRENCIES[currency].minorDigits : 2;
}

/**
 * Parse a user-entered decimal string into minor units.
 * Accepts Arabic-Indic digits and Arabic decimal separators.
 * Returns null when the input is not a well-formed non-negative amount.
 */
export function parseMoney(input: string | number, currency: string = DEFAULT_CURRENCY): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 10 ** minorDigits(currency));
  }

  const normalised = normaliseDigits(String(input))
    .replace(/[٫،,]/g, '.')
    .replace(/\s/g, '')
    .trim();

  if (normalised === '') return null;
  if (!/^\d*(\.\d*)?$/.test(normalised)) return null;

  const digits = minorDigits(currency);
  const [whole = '0', fraction = ''] = normalised.split('.');
  const paddedFraction = (fraction + '0'.repeat(digits)).slice(0, digits);
  const value = Number(`${whole || '0'}${paddedFraction}`);

  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

/** Convert Arabic-Indic and Eastern Arabic-Indic digits to ASCII. */
export function normaliseDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (char) => {
    const code = char.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Render minor units as a plain decimal string, e.g. 235000 -> "235.000". */
export function toDecimalString(minor: number, currency: string = DEFAULT_CURRENCY): string {
  const digits = minorDigits(currency);
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const str = abs.toString().padStart(digits + 1, '0');
  const whole = str.slice(0, str.length - digits) || '0';
  const fraction = digits > 0 ? `.${str.slice(str.length - digits)}` : '';
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

/**
 * Locale-aware display, e.g. "235.000 د.ل".
 * Arabic locale is forced to Latin digits: merchants read order totals faster
 * in ASCII numerals, and RTL bidi handling stays predictable.
 */
export function formatMoney(
  minor: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = 'ar',
): string {
  const digits = minorDigits(currency);
  const value = minor / 10 ** digits;
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-LY-u-nu-latn' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

  const meta = isCurrencyCode(currency) ? CURRENCIES[currency] : null;
  const symbol = meta ? (locale === 'ar' ? meta.symbolAr : meta.symbolEn) : currency;
  return `${formatted} ${symbol}`;
}

/** Compact display for KPI tiles: 12.4K, 3.1M. */
export function formatMoneyCompact(
  minor: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = 'ar',
): string {
  const digits = minorDigits(currency);
  const value = minor / 10 ** digits;
  const meta = isCurrencyCode(currency) ? CURRENCIES[currency] : null;
  const symbol = meta ? (locale === 'ar' ? meta.symbolAr : meta.symbolEn) : currency;

  if (Math.abs(value) < 1000) return formatMoney(minor, currency, locale);

  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-LY-u-nu-latn' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
  return `${formatted} ${symbol}`;
}

/** Apply a whole-percent discount, rounding half up on the minor unit. */
export function applyPercent(minor: number, percent: number): number {
  if (percent <= 0) return minor;
  const clamped = Math.min(100, Math.max(0, percent));
  return minor - Math.round((minor * clamped) / 100);
}

export function sumMoney(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function formatNumber(value: number, locale: string = 'ar'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-LY-u-nu-latn' : 'en-US').format(value);
}

export function formatPercent(value: number, locale: string = 'ar', digits = 1): string {
  return `${new Intl.NumberFormat(locale === 'ar' ? 'ar-LY-u-nu-latn' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;
}
