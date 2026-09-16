import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { AppsGrid } from '@/features/apps/apps-grid';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { getEntitlements } from '@/server/services/billing-service';
import { listStoreApps } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'التطبيقات' };
export const dynamic = 'force-dynamic';

export default async function AppsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('apps.manage');
  const t = getTranslations(params.locale, 'apps');

  const [apps, entitlements] = await Promise.all([
    listStoreApps(context),
    getEntitlements(context.storeId),
  ]);

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <AppsGrid
        apps={apps.map((app) => ({
          key: app.key,
          nameAr: app.nameAr,
          nameEn: app.nameEn,
          descriptionAr: app.descriptionAr,
          descriptionEn: app.descriptionEn,
          category: app.category,
          icon: app.icon,
          settingsRoute: app.settingsRoute,
          isCore: app.isCore,
          isEnabled: app.isEnabled,
          // Plan gating is resolved on the server; the card explains *why* an
          // app is unavailable instead of silently disabling the toggle.
          availableInPlan:
            app.requiredFeature === null || entitlements.features.has(app.requiredFeature),
        }))}
        locale={params.locale}
      />
    </div>
  );
}
