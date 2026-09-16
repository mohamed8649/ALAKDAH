import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { emptyProduct } from '@/features/products/editor-mapping';
import { ProductEditor } from '@/features/products/product-editor';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';

export const metadata: Metadata = { title: 'منتج جديد' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('products.create');
  const t = getTranslations(params.locale, 'products');

  return (
    <div>
      <PageHeader
        title={t('createTitle')}
        backHref={`/${params.locale}/dashboard/products`}
        backLabel={t('title')}
      />

      <ProductEditor
        initial={emptyProduct(context.currency)}
        locale={params.locale}
        currency={context.currency}
        canDelete={false}
      />
    </div>
  );
}
