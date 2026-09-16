import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { AiPageGenerator } from '@/features/pages/ai-page-generator';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { assertFeature } from '@/server/services/billing-service';
import { searchProductsForPicker } from '@/server/services/product-service';
import { listTrustBadges } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'توليد صفحة هبوط' };
export const dynamic = 'force-dynamic';

export default async function GeneratePagePage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('pages.manage');
  // Gate on the server, not just by hiding the entry card.
  await assertFeature(context.storeId, 'ai_tools');

  const t = getTranslations(params.locale, 'pages');

  const [products, badges] = await Promise.all([
    searchProductsForPicker(context, '', 100),
    listTrustBadges(context.storeId, true),
  ]);

  return (
    <div>
      <PageHeader
        title={t('createAi')}
        description={t('createAiHint')}
        backHref={`/${params.locale}/dashboard/pages`}
        backLabel={t('title')}
      />

      <AiPageGenerator
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.id,
          price: product.price,
          imageUrl: product.imageUrl,
        }))}
        badges={badges.map((badge) => ({
          id: badge.id,
          title: badge.title,
          description: badge.description,
          icon: badge.icon,
        }))}
        currency={context.currency}
        locale={params.locale}
      />
    </div>
  );
}
