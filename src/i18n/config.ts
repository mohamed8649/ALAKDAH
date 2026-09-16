export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

/**
 * French is a planned third locale. The structure below (and the messages/
 * directory layout) is designed so adding it is a data change, not a code
 * change: add 'fr' here and drop in messages/fr.json.
 */
export const LOCALE_META: Record<Locale, { name: string; nativeName: string; dir: 'rtl' | 'ltr' }> = {
  ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  en: { name: 'English', nativeName: 'English', dir: 'ltr' },
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

export function direction(locale: Locale): 'rtl' | 'ltr' {
  return LOCALE_META[locale].dir;
}
