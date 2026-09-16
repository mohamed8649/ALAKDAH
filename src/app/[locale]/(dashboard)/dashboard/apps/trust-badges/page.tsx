import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { TrustBadgesEditor } from '@/features/apps/trust-badges-editor';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { listTrustBadges } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'شارات الثقة' };
export const dynamic = 'force-dynamic';

export default async function TrustBadgesPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('storefront.manage');
  const t = getTranslations(params.locale, 'trustBadges');
  const badges = await listTrustBadges(context.storeId);

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        backHref={`/${params.locale}/dashboard/apps`}
      />
      <TrustBadgesEditor
        initial={badges.map((badge) => ({
          title: badge.title,
          description: badge.description,
          icon: badge.icon,
          isActive: badge.isActive,
        }))}
      />
    </div>
  );
}
