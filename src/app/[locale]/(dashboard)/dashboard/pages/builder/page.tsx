import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { PageBuilder } from '@/features/pages/page-builder';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { searchProductsForPicker } from '@/server/services/product-service';
import { listTrustBadges } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'محرر الصفحة' };
export const dynamic = 'force-dynamic';

export default async function NewPageBuilder({ params }: { params: { locale: string } }) {
  const context = await requirePermission('pages.manage');
  const t = getTranslations(params.locale, 'pages');

  const [products, badges] = await Promise.all([
    searchProductsForPicker(context, '', 100),
    listTrustBadges(context.storeId, true),
  ]);

  return (
    <div>
      <PageHeader
        title={t('createManual')}
        backHref={`/${params.locale}/dashboard/pages`}
        backLabel={t('title')}
      />

      <PageBuilder
        pageId={null}
        initial={{
          title: '',
          slug: '',
          productId: null,
          document: { version: 1, blocks: [] },
          seoTitle: '',
          seoDescription: '',
          status: 'DRAFT',
        }}
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
        storeSlug={context.storeSlug}
        currency={context.currency}
        canManage
      />
    </div>
  );
}
