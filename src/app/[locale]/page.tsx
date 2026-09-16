import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Headphones, Package, ShoppingBag, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/server';
import { getSessionUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Entry page.
 *
 * A signed-in merchant never sees this — they go straight to their dashboard.
 * For everyone else it is a short, honest description of what the platform does
 * and two ways in. Deliberately restrained: this is a product entry point, not
 * a marketing site.
 */
export default async function LandingPage({ params }: { params: { locale: string } }) {
  if (await getSessionUser()) redirect(`/${params.locale}/dashboard`);

  const t = getTranslations(params.locale, 'app');
  const tAuth = getTranslations(params.locale, 'auth');
  const tNav = getTranslations(params.locale, 'nav');

  const features = [
    { icon: Package, label: tNav('products') },
    { icon: ShoppingBag, label: tNav('orders') },
    { icon: Headphones, label: tNav('callCenter') },
    { icon: Truck, label: tNav('shipping') },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[var(--radius)] bg-primary text-sm font-bold text-[var(--primary-foreground)]">
            ع
          </span>
          <span className="text-sm font-semibold text-foreground">{t('name')}</span>
        </span>

        <div className="flex items-center gap-2">
          <Link
            href={`/${params.locale === 'ar' ? 'en' : 'ar'}`}
            className="rounded-[var(--radius)] px-2 py-1 text-xs text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
          >
            {params.locale === 'ar' ? 'English' : 'العربية'}
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${params.locale}/login`}>{tAuth('login')}</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg text-center">
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            {t('tagline')}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {tAuth('registerSubtitle')}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild variant="primary" size="touch">
              <Link href={`/${params.locale}/register`}>
                {tAuth('register')}
                <ArrowLeft className="rtl-flip" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="touch">
              <Link href={`/${params.locale}/login`}>{tAuth('login')}</Link>
            </Button>
          </div>

          <ul className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li
                  key={feature.label}
                  className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-border bg-surface-1 px-3 py-2.5 text-start"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--primary-soft)] text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-[13px] text-foreground">{feature.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </main>

      <footer className="px-4 py-6 text-center">
        <Link
          href={`/${params.locale}/agent/login`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {tAuth('agentLogin')}
        </Link>
      </footer>
    </div>
  );
}
