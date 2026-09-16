import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { SubNav } from '@/components/layout/sub-nav';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  await requirePermission('settings.view');
  const t = getTranslations(params.locale, 'settings');
  const base = `/${params.locale}/dashboard/settings`;

  return (
    <div>
      <PageHeader title={t('title')} />
      <SubNav
        items={[
          { href: `${base}/identity`, label: t('sections.identity') },
          { href: `${base}/checkout`, label: t('sections.checkout') },
          { href: `${base}/notifications`, label: t('sections.notifications') },
          { href: `${base}/security`, label: t('sections.security') },
          { href: `${base}/tokens`, label: t('sections.tokens') },
        ]}
      />
      <div className="mt-4 max-w-3xl">{children}</div>
    </div>
  );
}
