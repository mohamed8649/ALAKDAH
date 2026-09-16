import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { ImportWizard } from '@/features/integrations/import-wizard';
import { getTranslations } from '@/i18n/server';
import { getIntegrationProvider, importFieldsFor } from '@/server/catalog/integrations';
import { requirePermission } from '@/server/policies/context';

export const metadata: Metadata = { title: 'استيراد بيانات' };
export const dynamic = 'force-dynamic';

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { source?: string };
}) {
  // Importing writes products or orders, so the gate is the same one the
  // manual create screens use, not a weaker "settings" permission.
  await requirePermission('products.create');

  const t = getTranslations(params.locale, 'import');

  // An unknown ?source= falls back to the plain CSV path rather than erroring:
  // the query parameter is a convenience, not an authorisation decision.
  const source = getIntegrationProvider(searchParams.source ?? '')?.key ?? 'csv';

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        backHref={`/${params.locale}/dashboard/integrations`}
        backLabel={getTranslations(params.locale, 'integrations')('title')}
      />

      <ImportWizard
        source={source}
        fields={{
          products: [...importFieldsFor('products')],
          orders: [...importFieldsFor('orders')],
        }}
        locale={params.locale}
      />
    </div>
  );
}
