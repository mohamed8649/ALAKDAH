'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_LOCALE, direction, type Locale } from './config';
import { translate, type Messages } from './messages';

interface I18nValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  messages: Messages;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, dir: direction(locale), messages }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useTranslations must be used inside an I18nProvider.');
  }
  return value;
}

export type Translator = (key: string, values?: Record<string, string | number>) => string;

/**
 * Scoped translator. `useTranslations('orders')` then `t('status.NEW')`.
 * Passing no namespace gives access to the whole dictionary.
 */
export function useTranslations(namespace?: string): Translator {
  const { messages } = useI18n();
  return useMemo(
    () => (key: string, values?: Record<string, string | number>) =>
      translate(messages, namespace ? `${namespace}.${key}` : key, values),
    [messages, namespace],
  );
}

export function useLocale(): Locale {
  return useContext(I18nContext)?.locale ?? DEFAULT_LOCALE;
}

export function useDirection(): 'rtl' | 'ltr' {
  return useContext(I18nContext)?.dir ?? 'rtl';
}
