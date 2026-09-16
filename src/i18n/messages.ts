import ar from '../../messages/ar.json';
import en from '../../messages/en.json';

import { DEFAULT_LOCALE, type Locale } from './config';

export type Messages = typeof ar;

const DICTIONARIES: Record<Locale, Messages> = {
  ar,
  en: en as Messages,
};

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Look up a dotted key such as "orders.status.NEW".
 * Falls back to Arabic, then to the key itself — a missing translation shows a
 * visible key in development rather than an empty element.
 */
export function translate(
  messages: Messages,
  key: string,
  values?: Record<string, string | number>,
): string {
  const resolved = lookup(messages, key) ?? lookup(DICTIONARIES[DEFAULT_LOCALE], key);
  if (resolved === null) return key;
  return values ? interpolate(resolved, values) : resolved;
}

function lookup(source: unknown, key: string): string | null {
  const segments = key.split('.');
  let current: unknown = source;

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) return null;
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : null;
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}
