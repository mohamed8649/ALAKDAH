import { NextResponse, type NextRequest } from 'next/server';

import { DEFAULT_LOCALE, LOCALES } from './i18n/config';

/**
 * Locale routing.
 *
 * Every page lives under /{locale}. A request without one is redirected to the
 * visitor's preferred locale if we support it, otherwise to Arabic.
 *
 * REBUILD PROPOSAL — custom storefront domains are resolved here too: a request
 * arriving on a domain that is not the app's own host is rewritten to that
 * store's storefront path, so a merchant's own domain serves their shop without
 * the /{locale}/{storeSlug} prefix appearing in the URL.
 */

const PUBLIC_FILE = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|xml|woff2?|map)$/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (hasLocale) return NextResponse.next();

  const locale = negotiateLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

function negotiateLocale(request: NextRequest): string {
  const header = request.headers.get('accept-language');
  if (!header) return DEFAULT_LOCALE;

  const preferred = header
    .split(',')
    .map((part) => {
      const [tag = '', quality = 'q=1'] = part.trim().split(';');
      return { tag: tag.split('-')[0]!.toLowerCase(), q: Number(quality.replace('q=', '')) || 0 };
    })
    .sort((a, b) => b.q - a.q);

  const match = preferred.find((entry) => (LOCALES as readonly string[]).includes(entry.tag));
  return match?.tag ?? DEFAULT_LOCALE;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)'],
};
