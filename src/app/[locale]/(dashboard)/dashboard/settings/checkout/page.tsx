import type { Metadata } from 'next';

import { CheckoutSettingsView } from '@/features/settings/checkout-settings';
import { hasPermission, requirePermission } from '@/server/policies/context';
import {
  getCheckoutFields,
  getStoreSettings,
  listCustomFields,
} from '@/server/services/store-service';

export const metadata: Metadata = { title: 'إعدادات إتمام الطلب' };
export const dynamic = 'force-dynamic';

export default async function CheckoutSettingsPage() {
  const context = await requirePermission('settings.view');

  const [fields, customFields, settings] = await Promise.all([
    getCheckoutFields(context.storeId),
    listCustomFields(context.storeId),
    getStoreSettings(context.storeId),
  ]);

  return (
    <CheckoutSettingsView
      fields={fields}
      customFields={JSON.parse(JSON.stringify(customFields))}
      settings={{
        cartEnabled: settings.cartEnabled,
        thankYouEnabled: settings.thankYouEnabled,
        thankYouTitle: settings.thankYouTitle,
        thankYouMessage: settings.thankYouMessage,
        thankYouButtonText: settings.thankYouButtonText,
        thankYouButtonUrl: settings.thankYouButtonUrl ?? '',
        quickContactPhoneEnabled: settings.quickContactPhoneEnabled,
        quickContactPhone: settings.quickContactPhone ?? '',
        quickContactWhatsappEnabled: settings.quickContactWhatsappEnabled,
        quickContactWhatsapp: settings.quickContactWhatsapp ?? '',
        quickContactCountryCode: settings.quickContactCountryCode,
        trackingEnabled: settings.trackingEnabled,
        trackingMethod: settings.trackingMethod,
      }}
      canManage={hasPermission(context, 'settings.manage')}
    />
  );
}
