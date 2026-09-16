import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ProductsTable } from '@/features/products/products-table';
import { getTranslations } from '@/i18n/server';
import { hasPermission, requireStoreContext } from '@/server/policies/context';
import { listProducts } from '@/server/services/product-service';
import { productFilterSchema } from '@/validators/product';

export const metadata: Metadata = { title: 'المنتجات' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const context = await requireStoreContext();
  const t = getTranslations(params.locale, 'products');

  // Unparseable query strings fall back to defaults rather than erroring — a
  // hand-edited URL should not break the page.
  const filter = productFilterSchema.parse(flatten(searchParams));
  const result = await listProducts(context, filter);

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          hasPermission(context, 'products.create') ? (
            <Button asChild variant="primary" size="sm">
              <Link href={`/${params.locale}/dashboard/products/new`}>
                <Plus aria-hidden />
                {t('create')}
              </Link>
            </Button>
          ) : null
        }
      />

      <ProductsTable
        result={result}
        locale={params.locale}
        currency={context.currency}
        canEdit={hasPermission(context, 'products.edit')}
        canDelete={hasPermission(context, 'products.delete')}
        canAdjustStock={hasPermission(context, 'inventory.manage')}
      />
    </div>
  );
}

function flatten(searchParams: Record<string, string | string[] | undefined>) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) result[key] = first;
  }
  return result;
}
