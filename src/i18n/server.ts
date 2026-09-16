import { resolveLocale, type Locale } from './config';
import { getMessages, translate } from './messages';

export type ServerTranslator = (key: string, values?: Record<string, string | number>) => string;

/** Server-side counterpart of useTranslations, for server components. */
export function getTranslations(locale: Locale | string, namespace?: string): ServerTranslator {
  const messages = getMessages(resolveLocale(locale as string));
  return (key, values) => translate(messages, namespace ? `${namespace}.${key}` : key, values);
}

export { getMessages };
