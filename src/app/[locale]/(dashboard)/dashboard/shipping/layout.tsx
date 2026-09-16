import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { SubNav } from '@/components/layout/sub-nav';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';

export default async function ShippingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  await requirePermission('shipping.view');
  const t = getTranslations(params.locale, 'shipping');
  const base = `/${params.locale}/dashboard/shipping`;

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <SubNav
        items={[
          { href: `${base}/methods`, label: t('methods') },
          { href: `${base}/providers`, label: t('providers') },
          { href: `${base}/rules`, label: t('rules') },
          { href: `${base}/delivery-slip`, label: t('deliverySlip') },
        ]}
      />
      <div className="mt-4">{children}</div>
    </div>
  );
}
