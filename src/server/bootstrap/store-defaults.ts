import { prisma } from '@/db/client';
import { APP_DEFINITIONS } from '@/server/catalog/apps';
import { DEFAULT_THEME_KEY } from '@/server/catalog/themes';

/**
 * Per-store bootstrapping.
 *
 * Kept out of the service layer (and free of `server-only`) so the seed script
 * can call the exact same code path a real registration runs. A demo store
 * configured differently from a real one is a demo of something that does not
 * exist.
 */

export const CHECKOUT_FIELD_KEYS = [
  'customerName',
  'phone',
  'email',
  'state',
  'city',
  'address',
  'deliveryType',
  'notes',
] as const;

export type CheckoutFieldKey = (typeof CHECKOUT_FIELD_KEYS)[number];

/**
 * Phone cannot be hidden. With cash on delivery there is no way to reach the
 * customer without it, so the option is not offered rather than silently
 * ignored.
 */
export const LOCKED_CHECKOUT_FIELDS: readonly CheckoutFieldKey[] = ['phone'];

export const DEFAULT_CHECKOUT_FIELDS: Array<{
  fieldKey: CheckoutFieldKey;
  mode: 'REQUIRED' | 'OPTIONAL' | 'HIDDEN';
}> = [
  { fieldKey: 'customerName', mode: 'REQUIRED' },
  { fieldKey: 'phone', mode: 'REQUIRED' },
  { fieldKey: 'email', mode: 'HIDDEN' },
  { fieldKey: 'state', mode: 'REQUIRED' },
  { fieldKey: 'city', mode: 'REQUIRED' },
  { fieldKey: 'address', mode: 'REQUIRED' },
  { fieldKey: 'deliveryType', mode: 'OPTIONAL' },
  { fieldKey: 'notes', mode: 'OPTIONAL' },
];

const DEFAULT_TRUST_BADGES = [
  { title: 'الدفع عند الاستلام', description: 'ادفع نقداً عند استلام طلبك.', icon: 'truck' },
  { title: 'منتجات أصلية', description: 'نضمن جودة ما تشتريه.', icon: 'award' },
  { title: 'إرجاع سهل', description: 'يمكنك إرجاع المنتج خلال ٣ أيام.', icon: 'refresh' },
  { title: 'دعم سريع', description: 'نرد على استفساراتك خلال ساعات.', icon: 'headphones' },
];

/**
 * Everything a brand-new store needs to be usable immediately: settings,
 * checkout fields, trust badges, a delivery method with a fallback zone, the
 * free plan, the default theme and the core apps.
 *
 * Idempotent — safe to re-run against an existing store.
 */
export async function seedStoreDefaults(storeId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.storeSettings.upsert({
      where: { storeId },
      create: { storeId },
      update: {},
    });

    await tx.checkoutField.createMany({
      data: DEFAULT_CHECKOUT_FIELDS.map((field, index) => ({
        storeId,
        fieldKey: field.fieldKey,
        mode: field.mode,
        position: index,
      })),
      skipDuplicates: true,
    });

    const badgeCount = await tx.trustBadge.count({ where: { storeId } });
    if (badgeCount === 0) {
      await tx.trustBadge.createMany({
        data: DEFAULT_TRUST_BADGES.map((badge, index) => ({
          storeId,
          title: badge.title,
          description: badge.description,
          icon: badge.icon,
          position: index,
          isActive: true,
        })),
      });
    }

    await tx.deliverySlipConfig.upsert({
      where: { storeId },
      create: { storeId },
      update: {},
    });

    const methodCount = await tx.shippingMethod.count({ where: { storeId } });
    if (methodCount === 0) {
      const method = await tx.shippingMethod.create({
        data: {
          storeId,
          name: 'توصيل داخل المدينة',
          nameEn: 'City delivery',
          type: 'DELIVERY',
          price: 15_000,
          isActive: true,
          isDefault: true,
          supportsCod: true,
          minDeliveryDays: 1,
          maxDeliveryDays: 3,
        },
        select: { id: true },
      });

      // A zone with no regions is the method's fallback price, so a store with
      // no zone configuration still quotes a price at checkout.
      await tx.shippingZone.create({
        data: {
          storeId,
          methodId: method.id,
          name: 'كل المناطق',
          price: 15_000,
          regions: [],
          cities: [],
          position: 0,
        },
      });
    }

    await tx.appInstallation.createMany({
      data: APP_DEFINITIONS.map((app) => ({
        storeId,
        appKey: app.key,
        isEnabled: app.defaultEnabled,
      })),
      skipDuplicates: true,
    });

    const paygPlan = await tx.plan.findFirst({ where: { isPayg: true }, select: { key: true } });
    if (paygPlan) {
      const now = new Date();
      await tx.subscription.upsert({
        where: { storeId },
        create: {
          storeId,
          planKey: paygPlan.key,
          status: 'ACTIVE',
          interval: 'MONTHLY',
          currentPeriodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
          currentPeriodEnd: new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
          ),
        },
        update: {},
      });
    }

    const theme = await tx.themeDefinition.findFirst({ where: { key: DEFAULT_THEME_KEY } });
    if (theme) {
      await tx.storeTheme.upsert({
        where: { storeId },
        create: { storeId, themeKey: theme.key, installedThemes: [theme.key] },
        update: {},
      });
    }
  });
}
