import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { RegisterForm } from '@/features/auth/register-form';
import { getTranslations } from '@/i18n/server';
import { getSessionUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'إنشاء متجر' };

export default async function RegisterPage({ params }: { params: { locale: string } }) {
  if (await getSessionUser()) redirect(`/${params.locale}/dashboard`);

  const t = getTranslations(params.locale, 'auth');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">{t('registerTitle')}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">{t('registerSubtitle')}</p>

      <div className="mt-6">
        <RegisterForm locale={params.locale} appUrl={appUrl} />
      </div>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link href={`/${params.locale}/login`} className="font-medium text-primary hover:underline">
          {t('login')}
        </Link>
      </p>
    </div>
  );
}
