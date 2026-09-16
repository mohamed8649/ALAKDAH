/**
 * Phone normalisation.
 *
 * Duplicate detection, customer matching and fraud rules all compare phones.
 * Raw string equality is unreliable (091-234-5678 vs +218912345678 vs Arabic
 * digits), so every stored phone has a canonical form produced here.
 */

import { normaliseDigits } from './money';

export interface CountryPhoneRule {
  code: string;
  dialCode: string;
  /** National significant number length, excluding the trunk prefix. */
  nsnLength: number;
  trunkPrefix: string;
  /** Valid leading digits of the national significant number. */
  mobilePrefixes: readonly string[];
}

export const COUNTRY_PHONE_RULES: Record<string, CountryPhoneRule> = {
  LY: { code: 'LY', dialCode: '218', nsnLength: 9, trunkPrefix: '0', mobilePrefixes: ['91', '92', '93', '94', '95'] },
  TN: { code: 'TN', dialCode: '216', nsnLength: 8, trunkPrefix: '', mobilePrefixes: ['2', '4', '5', '9'] },
  EG: { code: 'EG', dialCode: '20', nsnLength: 10, trunkPrefix: '0', mobilePrefixes: ['10', '11', '12', '15'] },
  DZ: { code: 'DZ', dialCode: '213', nsnLength: 9, trunkPrefix: '0', mobilePrefixes: ['5', '6', '7'] },
  MA: { code: 'MA', dialCode: '212', nsnLength: 9, trunkPrefix: '0', mobilePrefixes: ['6', '7'] },
};

export const DEFAULT_COUNTRY = 'LY';

export interface NormalisedPhone {
  /** E.164 without the leading plus, e.g. "218912345678". */
  canonical: string;
  /** National form as a merchant would dial it, e.g. "0912345678". */
  national: string;
  country: string;
  valid: boolean;
}

/**
 * Produce the canonical form of a phone number.
 *
 * Always returns a canonical string — even for input we cannot validate — so a
 * merchant is never blocked from recording an order they took by phone. The
 * `valid` flag tells the UI whether to warn.
 */
export function normalisePhone(input: string, country: string = DEFAULT_COUNTRY): NormalisedPhone {
  const rule = COUNTRY_PHONE_RULES[country] ?? COUNTRY_PHONE_RULES[DEFAULT_COUNTRY]!;

  const cleaned = normaliseDigits(String(input ?? ''))
    .replace(/[\s\-().‏‎]/g, '')
    .trim();

  let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  digits = digits.replace(/\D/g, '');

  if (digits === '') {
    return { canonical: '', national: '', country: rule.code, valid: false };
  }

  // 00218... international prefix
  if (digits.startsWith('00')) digits = digits.slice(2);

  let nsn: string;
  if (digits.startsWith(rule.dialCode) && digits.length > rule.dialCode.length) {
    nsn = digits.slice(rule.dialCode.length);
  } else {
    nsn = digits;
  }

  // Strip trunk prefix (Libyan numbers are commonly written as 0912345678).
  if (rule.trunkPrefix && nsn.startsWith(rule.trunkPrefix) && nsn.length > rule.nsnLength) {
    nsn = nsn.slice(rule.trunkPrefix.length);
  }

  const valid =
    nsn.length === rule.nsnLength &&
    rule.mobilePrefixes.some((prefix) => nsn.startsWith(prefix));

  return {
    canonical: `${rule.dialCode}${nsn}`,
    national: `${rule.trunkPrefix}${nsn}`,
    country: rule.code,
    valid,
  };
}

export function isValidPhone(input: string, country: string = DEFAULT_COUNTRY): boolean {
  return normalisePhone(input, country).valid;
}

/**
 * Display format. Wrapped in LTR isolation marks so a phone number inside an
 * Arabic RTL paragraph does not get its digit groups reordered by the bidi
 * algorithm.
 */
export function formatPhone(canonical: string, country: string = DEFAULT_COUNTRY): string {
  if (!canonical) return '';
  const rule = COUNTRY_PHONE_RULES[country] ?? COUNTRY_PHONE_RULES[DEFAULT_COUNTRY]!;
  const nsn = canonical.startsWith(rule.dialCode) ? canonical.slice(rule.dialCode.length) : canonical;

  if (nsn.length === 9) {
    return `${rule.trunkPrefix}${nsn.slice(0, 2)}-${nsn.slice(2, 5)}-${nsn.slice(5)}`;
  }
  return `${rule.trunkPrefix}${nsn}`;
}

/** Wrap a phone for safe inline rendering inside RTL text. */
export function isolateLtr(value: string): string {
  return `⁦${value}⁩`;
}

export function toWhatsAppLink(phone: string, country: string = DEFAULT_COUNTRY, message?: string): string {
  const { canonical } = normalisePhone(phone, country);
  const base = `https://wa.me/${canonical}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function toTelLink(phone: string, country: string = DEFAULT_COUNTRY): string {
  const { canonical } = normalisePhone(phone, country);
  return `tel:+${canonical}`;
}
