import type { Metadata } from 'next';

import { SecuritySettingsView } from '@/features/settings/security-settings';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { getStoreSettings, listBlockedIps } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'الأمان' };
export const dynamic = 'force-dynamic';

export default async function SecuritySettingsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('settings.view');

  const [settings, ips] = await Promise.all([
    getStoreSettings(context.storeId),
    listBlockedIps(context),
  ]);

  return (
    <SecuritySettingsView
      initial={{
        fraudProtectionEnabled: settings.fraudProtectionEnabled,
        fraudMaxOrders: settings.fraudMaxOrders,
        fraudWindowHours: settings.fraudWindowHours,
        fraudAction: settings.fraudAction,
        abandonedTrackingEnabled: settings.abandonedTrackingEnabled,
      }}
      blockedIps={JSON.parse(JSON.stringify(ips))}
      locale={params.locale}
      canManage={hasPermission(context, 'settings.manage')}
    />
  );
}
