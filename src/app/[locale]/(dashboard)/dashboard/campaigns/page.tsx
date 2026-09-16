import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { CampaignsManager } from '@/features/campaigns/campaigns-manager';
import { getTranslations } from '@/i18n/server';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listCampaigns } from '@/server/services/campaign-service';
import { searchProductsForPicker } from '@/server/services/product-service';

export const metadata: Metadata = { title: 'العروض' };
export const dynamic = 'force-dynamic';

export default async function CampaignsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('campaigns.view');
  const t = getTranslations(params.locale, 'campaigns');

  const [campaigns, products] = await Promise.all([
    listCampaigns(context),
    hasPermission(context, 'products.view')
      ? searchProductsForPicker(context, '', 200)
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <CampaignsManager
        campaigns={JSON.parse(JSON.stringify(campaigns))}
        products={products.map((product) => ({ id: product.id, name: product.name }))}
        locale={params.locale}
        timezone={context.timezone}
        canManage={hasPermission(context, 'campaigns.manage')}
      />
    </div>
  );
}
