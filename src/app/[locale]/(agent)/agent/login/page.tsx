import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { AgentLoginForm } from '@/features/call-center/agent-login-form';
import { getTranslations } from '@/i18n/server';
import { getSessionAgent } from '@/server/auth/session';

export const metadata: Metadata = { title: 'بوابة مركز الاتصال' };
export const dynamic = 'force-dynamic';

export default async function AgentLoginPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { store?: string };
}) {
  if (await getSessionAgent()) redirect(`/${params.locale}/agent/orders`);

  const t = getTranslations(params.locale, 'auth');

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-[var(--radius-lg)] bg-primary text-base font-bold text-[var(--primary-foreground)]">
              ع
            </span>
            <h1 className="text-lg font-semibold text-foreground">{t('agentLoginTitle')}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('agentLoginSubtitle')}</p>
          </div>

          <AgentLoginForm locale={params.locale} defaultStore={searchParams.store ?? ''} />

          <div className="mt-6 border-t border-border pt-4 text-center">
            <Link
              href={`/${params.locale}/login`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('backToMerchantLogin')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
