import type { Metadata } from 'next';

import { StoreIdentityForm } from '@/features/settings/store-identity-form';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { getStore } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'هوية المتجر' };
export const dynamic = 'force-dynamic';

export default async function IdentitySettingsPage() {
  const context = await requirePermission('settings.view');
  const store = await getStore(context.storeId);

  return (
    <StoreIdentityForm
      initial={{
        name: store.name,
        description: store.description ?? '',
        phone: store.phone ?? '',
        email: store.email ?? '',
        logoUrl: store.logoUrl ?? '',
        faviconUrl: store.faviconUrl ?? '',
        instagram: store.instagram ?? '',
        facebook: store.facebook ?? '',
        tiktok: store.tiktok ?? '',
        telegram: store.telegram ?? '',
        whatsapp: store.whatsapp ?? '',
        defaultLocale: store.defaultLocale as 'ar' | 'en',
        currency: store.currency as 'LYD',
        timezone: store.timezone,
      }}
      storeSlug={store.slug}
      canManage={hasPermission(context, 'settings.manage')}
    />
  );
}
