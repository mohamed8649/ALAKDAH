import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { DesignEditor } from '@/features/themes/design-editor';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { getStore } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'تصميم المتجر' };
export const dynamic = 'force-dynamic';

export default async function DesignPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('storefront.manage');
  const t = getTranslations(params.locale, 'design');
  const store = await getStore(context.storeId);

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <DesignEditor
        initial={{
          primaryColor: store.primaryColor,
          secondaryColor: store.secondaryColor,
          fontFamily: store.fontFamily as 'ibm-plex-arabic',
          logoUrl: store.logoUrl ?? '',
          faviconUrl: store.faviconUrl ?? '',
          announcementEnabled: store.announcementEnabled,
          announcementText: store.announcementText ?? '',
        }}
        storeName={store.name}
        storeSlug={store.slug}
        locale={params.locale}
      />
    </div>
  );
}
