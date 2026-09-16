import Link from 'next/link';
import type { ReactNode } from 'react';

import { getTranslations } from '@/i18n/server';

/**
 * Auth layout.
 *
 * A single centred column. No marketing hero: the merchant came here to sign in.
 */
export default function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const t = getTranslations(params.locale, 'app');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <Link href={`/${params.locale}`} className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[var(--radius)] bg-primary text-sm font-bold text-[var(--primary-foreground)]">
            ع
          </span>
          <span className="text-sm font-semibold text-foreground">{t('name')}</span>
        </Link>
        <Link
          href={`/${params.locale === 'ar' ? 'en' : 'ar'}${''}`}
          className="rounded-[var(--radius)] px-2 py-1 text-xs text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
        >
          {params.locale === 'ar' ? 'English' : 'العربية'}
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="px-4 py-4 text-center text-2xs text-subtle-foreground">
        {t('name')} — {t('tagline')}
      </footer>
    </div>
  );
}
