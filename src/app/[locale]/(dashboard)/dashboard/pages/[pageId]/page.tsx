import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { PageBuilder } from '@/features/pages/page-builder';
import { getTranslations } from '@/i18n/server';
import { AppError } from '@/lib/errors';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { getPage } from '@/server/services/page-service';
import { searchProductsForPicker } from '@/server/services/product-service';
import { listTrustBadges } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'محرر الصفحة' };
export const dynamic = 'force-dynamic';

export default async function EditPageBuilder({
  params,
}: {
  params: { locale: string; pageId: string };
}) {
  const context = await requirePermission('pages.view');
  const t = getTranslations(params.locale, 'pages');

  let page;
  try {
    page = await getPage(context, params.pageId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const [products, badges] = await Promise.all([
    searchProductsForPicker(context, '', 100),
    listTrustBadges(context.storeId, true),
  ]);

  return (
    <div>
      <PageHeader
        title={page.title}
        backHref={`/${params.locale}/dashboard/pages`}
        backLabel={t('title')}
      />

      <PageBuilder
        pageId={page.id}
        initial={{
          title: page.title,
          slug: page.slug,
          productId: page.productId,
          document: page.document,
          seoTitle: page.seoTitle ?? '',
          seoDescription: page.seoDescription ?? '',
          status: page.status,
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
        canManage={hasPermission(context, 'pages.manage')}
      />
    </div>
  );
}
