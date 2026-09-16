import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/login-form';
import { getTranslations } from '@/i18n/server';
import { getSessionUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({ params }: { params: { locale: string } }) {
  // Already signed in: go straight to work rather than showing a form.
  if (await getSessionUser()) redirect(`/${params.locale}/dashboard`);

  const t = getTranslations(params.locale, 'auth');

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">{t('loginTitle')}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">{t('loginSubtitle')}</p>

      <div className="mt-6">
        <LoginForm locale={params.locale} />
      </div>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href={`/${params.locale}/register`} className="font-medium text-primary hover:underline">
          {t('register')}
        </Link>
      </p>

      <div className="mt-6 border-t border-border pt-4 text-center">
        <Link
          href={`/${params.locale}/agent/login`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t('agentLogin')}
        </Link>
      </div>
    </div>
  );
}
