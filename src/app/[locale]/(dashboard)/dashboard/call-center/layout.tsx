import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { SubNav } from '@/components/layout/sub-nav';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';

export default async function CallCenterLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  await requirePermission('callcenter.view');
  const t = getTranslations(params.locale, 'callCenter');

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <SubNav
        items={[
          { href: `/${params.locale}/dashboard/call-center/agents`, label: t('agents') },
          { href: `/${params.locale}/dashboard/call-center/rules`, label: t('rules') },
        ]}
      />
      <div className="mt-4">{children}</div>
    </div>
  );
}
