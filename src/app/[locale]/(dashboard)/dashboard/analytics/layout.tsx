import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { SubNav } from '@/components/layout/sub-nav';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';

export default async function AnalyticsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  await requirePermission('analytics.view');
  const t = getTranslations(params.locale, 'analytics');
  const base = `/${params.locale}/dashboard/analytics`;

  return (
    <div>
      <PageHeader title={t('title')} />
      <SubNav
        items={[
          { href: `${base}/orders`, label: t('orders') },
          { href: `${base}/products`, label: t('products') },
          { href: `${base}/pages`, label: t('pages') },
          { href: `${base}/call-center`, label: t('callCenter') },
        ]}
      />
      <div className="mt-4">{children}</div>
    </div>
  );
}
