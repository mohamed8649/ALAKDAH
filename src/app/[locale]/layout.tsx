import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/misc';
import { direction, isLocale, LOCALES, type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { I18nProvider } from '@/i18n/provider';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * Locale layout.
 *
 * Owns `lang` and `dir` on <html>, which is what makes RTL work natively:
 * logical CSS properties (`margin-inline-start`, `inset-inline-end`) then
 * resolve correctly everywhere without a single per-component RTL branch.
 */
export default function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();

  const locale = params.locale as Locale;
  const dir = direction(locale);

  return (
    <html lang={locale} dir={dir} data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
        <script
          // Applies the stored theme before first paint so a merchant who chose
          // light mode never sees a dark flash on navigation.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('akd-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <TooltipProvider delayDuration={250}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
