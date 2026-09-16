import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { PageHeader } from '@/components/layout/page-header';
import { QrGenerator } from '@/features/apps/qr-generator';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { getStore } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'مولّد QR' };
export const dynamic = 'force-dynamic';

export default async function QrPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('apps.manage');
  const t = getTranslations(params.locale, 'qr');
  const store = await getStore(context.storeId);

  // Built from the request host so the codes work in development, on a staging
  // domain and in production without a configured base URL.
  const host = headers().get('host') ?? '';
  const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  const base = host ? `${protocol}://${host}` : '';

  const shopPath = `/${params.locale}/${store.slug}`;

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        backHref={`/${params.locale}/dashboard/apps`}
      />
      <QrGenerator
        presets={[
          { label: store.name, url: `${base}${shopPath}` },
          { label: t('presets.products'), url: `${base}${shopPath}/products` },
          { label: t('presets.track'), url: `${base}${shopPath}/track` },
        ]}
      />
    </div>
  );
}
