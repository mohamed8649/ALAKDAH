import type { Metadata } from 'next';

import { NotificationSettingsForm } from '@/features/settings/notification-settings';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { getStoreSettings } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'الإشعارات' };
export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  const context = await requirePermission('settings.view');
  const settings = await getStoreSettings(context.storeId);

  return (
    <NotificationSettingsForm
      initial={{
        notificationsEnabled: settings.notificationsEnabled,
        notificationSound: settings.notificationSound,
        notificationVolume: settings.notificationVolume,
        notifyOnNewOrder: settings.notifyOnNewOrder,
        notifyOnConfirmed: settings.notifyOnConfirmed,
        notifyOnShipped: settings.notifyOnShipped,
      }}
      canManage={hasPermission(context, 'settings.manage')}
    />
  );
}
