import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { toEditorState } from '@/features/products/editor-mapping';
import { ProductEditor } from '@/features/products/product-editor';
import { getTranslations } from '@/i18n/server';
import { AppError } from '@/lib/errors';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { getProduct } from '@/server/services/product-service';

export const metadata: Metadata = { title: 'تعديل المنتج' };
export const dynamic = 'force-dynamic';

export default async function EditProductPage({
  params,
}: {
  params: { locale: string; productId: string };
}) {
  const context = await requirePermission('products.edit');
  const t = getTranslations(params.locale, 'products');

  let product;
  try {
    product = await getProduct(context, params.productId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  return (
    <div>
      <PageHeader
        title={product.name}
        description={t('editTitle')}
        backHref={`/${params.locale}/dashboard/products`}
        backLabel={t('title')}
      />

      <ProductEditor
        initial={toEditorState(product, context.currency)}
        locale={params.locale}
        currency={context.currency}
        canDelete={hasPermission(context, 'products.delete')}
      />
    </div>
  );
}
