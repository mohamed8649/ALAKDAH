import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { CustomersTable } from '@/features/customers/customers-table';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { listCustomers } from '@/server/services/customer-service';

export const metadata: Metadata = { title: 'العملاء' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { search?: string; sort?: string; page?: string };
}) {
  const context = await requirePermission('customers.view');
  const t = getTranslations(params.locale, 'customers');

  const result = await listCustomers(context, {
    search: searchParams.search,
    sort: (searchParams.sort as 'newest' | 'spent' | 'orders') ?? 'newest',
    page: Math.max(1, Number(searchParams.page) || 1),
    perPage: 25,
  });

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <CustomersTable
        result={JSON.parse(JSON.stringify(result))}
        locale={params.locale}
        currency={context.currency}
        country={context.country}
      />
    </div>
  );
}
