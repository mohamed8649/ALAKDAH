import 'server-only';

import { prisma } from '@/db/client';
import { AppError } from '@/lib/errors';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import { APP_DEFINITIONS } from '@/server/catalog/apps';
import {
  DEFAULT_CHECKOUT_FIELDS,
  LOCKED_CHECKOUT_FIELDS as LOCKED_FIELDS,
  type CheckoutFieldKey as FieldKey,
} from '@/server/bootstrap/store-defaults';
import type { CheckoutFieldsInput, CustomFieldInput, StoreIdentityInput, StoreSecurityInput, StoreNotificationInput } from '@/validators/store';

import { recordAudit } from './audit-service';

/**
 * Store settings, checkout configuration and per-store bootstrapping.
 */

export {
  CHECKOUT_FIELD_KEYS,
  LOCKED_CHECKOUT_FIELDS,
  seedStoreDefaults,
  type CheckoutFieldKey,
} from '@/server/bootstrap/store-defaults';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getStore(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { settings: true },
  });
  if (!store) throw new AppError('NOT_FOUND', 'Store not found.');
  return store;
}

export async function getStoreSettings(storeId: string) {
  const settings = await prisma.storeSettings.findUnique({ where: { storeId } });
  if (settings) return settings;
  return prisma.storeSettings.create({ data: { storeId } });
}

export async function updateStoreIdentity(
  context: StoreContext,
  input: StoreIdentityInput,
): Promise<void> {
  assertPermission(context, 'settings.manage');

  const before = await prisma.store.findUniqueOrThrow({
    where: { id: context.storeId },
    select: { name: true, description: true, phone: true, email: true },
  });

  await prisma.store.update({
    where: { id: context.storeId },
    data: {
      name: input.name,
      description: input.description || null,
      phone: input.phone || null,
      email: input.email || null,
      logoUrl: input.logoUrl || null,
      faviconUrl: input.faviconUrl || null,
      instagram: input.instagram || null,
      facebook: input.facebook || null,
      tiktok: input.tiktok || null,
      telegram: input.telegram || null,
      whatsapp: input.whatsapp || null,
      defaultLocale: input.defaultLocale,
      currency: input.currency,
      timezone: input.timezone,
    },
  });

  await recordAudit(context, {
    action: 'SETTINGS_UPDATED',
    entityType: 'store',
    entityId: context.storeId,
    before,
    after: { name: input.name, phone: input.phone, email: input.email },
  });
}

export async function updateStoreSecurity(
  context: StoreContext,
  input: StoreSecurityInput,
): Promise<void> {
  assertPermission(context, 'settings.manage');

  await prisma.storeSettings.upsert({
    where: { storeId: context.storeId },
    create: { storeId: context.storeId, ...input },
    update: input,
  });

  await recordAudit(context, {
    action: 'SETTINGS_UPDATED',
    entityType: 'store_security',
    entityId: context.storeId,
    after: input as unknown as Record<string, unknown>,
  });
}

export async function updateStoreNotifications(
  context: StoreContext,
  input: StoreNotificationInput,
): Promise<void> {
  assertPermission(context, 'settings.manage');

  await prisma.storeSettings.upsert({
    where: { storeId: context.storeId },
    create: { storeId: context.storeId, ...input },
    update: input,
  });
}

export async function updateCheckoutSettings(
  context: StoreContext,
  input: {
    cartEnabled: boolean;
    thankYouEnabled: boolean;
    thankYouTitle: string;
    thankYouMessage: string;
    thankYouButtonText: string;
    thankYouButtonUrl: string | null;
    quickContactPhoneEnabled: boolean;
    quickContactPhone: string | null;
    quickContactWhatsappEnabled: boolean;
    quickContactWhatsapp: string | null;
    quickContactCountryCode: string;
    trackingEnabled: boolean;
    trackingMethod: 'ORDER_NUMBER_AND_PHONE' | 'PHONE_ONLY' | 'ORDER_NUMBER_ONLY';
  },
): Promise<void> {
  assertPermission(context, 'settings.manage');

  await prisma.storeSettings.upsert({
    where: { storeId: context.storeId },
    create: { storeId: context.storeId, ...input },
    update: input,
  });

  await recordAudit(context, {
    action: 'SETTINGS_UPDATED',
    entityType: 'checkout_settings',
    entityId: context.storeId,
    after: input as unknown as Record<string, unknown>,
  });
}

// ---------------------------------------------------------------------------
// Checkout fields
// ---------------------------------------------------------------------------

export interface ResolvedCheckoutField {
  fieldKey: FieldKey;
  mode: 'REQUIRED' | 'OPTIONAL' | 'HIDDEN';
  locked: boolean;
  position: number;
}

export async function getCheckoutFields(storeId: string): Promise<ResolvedCheckoutField[]> {
  const rows = await prisma.checkoutField.findMany({
    where: { storeId },
    orderBy: { position: 'asc' },
  });

  const byKey = new Map(rows.map((row) => [row.fieldKey, row]));

  return DEFAULT_CHECKOUT_FIELDS.map((fallback, index) => {
    const row = byKey.get(fallback.fieldKey);
    const locked = LOCKED_FIELDS.includes(fallback.fieldKey);
    return {
      fieldKey: fallback.fieldKey,
      mode: locked ? 'REQUIRED' : ((row?.mode ?? fallback.mode) as ResolvedCheckoutField['mode']),
      locked,
      position: row?.position ?? index,
    };
  });
}

export async function updateCheckoutFields(
  context: StoreContext,
  input: CheckoutFieldsInput,
): Promise<void> {
  assertPermission(context, 'settings.manage');

  await prisma.$transaction(async (tx) => {
    for (const [index, field] of input.fields.entries()) {
      const locked = LOCKED_FIELDS.includes(field.fieldKey as FieldKey);
      const mode = locked ? 'REQUIRED' : field.mode;

      await tx.checkoutField.upsert({
        where: { storeId_fieldKey: { storeId: context.storeId, fieldKey: field.fieldKey } },
        create: { storeId: context.storeId, fieldKey: field.fieldKey, mode, position: index },
        update: { mode, position: index },
      });
    }
  });

  await recordAudit(context, {
    action: 'SETTINGS_UPDATED',
    entityType: 'checkout_fields',
    entityId: context.storeId,
    after: { fields: input.fields },
  });
}

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

export async function listCustomFields(storeId: string, activeOnly = false) {
  return prisma.customField.findMany({
    where: { storeId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { position: 'asc' },
  });
}

export async function saveCustomField(
  context: StoreContext,
  fieldId: string | null,
  input: CustomFieldInput,
): Promise<{ id: string }> {
  assertPermission(context, 'settings.manage');

  const data = {
    label: input.label,
    fieldKey: input.fieldKey,
    type: input.type,
    // Placeholders and help text render as plain text only — no HTML is stored
    // or interpreted, so a merchant cannot inject markup into their checkout.
    placeholder: input.placeholder || null,
    helpText: input.helpText || null,
    required: input.required,
    options: input.options,
    isActive: input.isActive,
    position: input.position,
  };

  if (fieldId) {
    const result = await prisma.customField.updateMany({
      where: { id: fieldId, storeId: context.storeId },
      data,
    });
    if (result.count === 0) throw new AppError('NOT_FOUND', 'Field not found.');
    return { id: fieldId };
  }

  const existing = await prisma.customField.findFirst({
    where: { storeId: context.storeId, fieldKey: input.fieldKey },
    select: { id: true },
  });
  if (existing) {
    throw new AppError('CONFLICT', 'Field key already used.', {
      fieldErrors: { fieldKey: ['errors.CONFLICT'] },
    });
  }

  return prisma.customField.create({
    data: { ...data, storeId: context.storeId },
    select: { id: true },
  });
}

export async function deleteCustomField(context: StoreContext, fieldId: string): Promise<void> {
  assertPermission(context, 'settings.manage');
  const result = await prisma.customField.deleteMany({
    where: { id: fieldId, storeId: context.storeId },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Field not found.');
}

// ---------------------------------------------------------------------------
// Trust badges
// ---------------------------------------------------------------------------

export async function listTrustBadges(storeId: string, activeOnly = false) {
  return prisma.trustBadge.findMany({
    where: { storeId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { position: 'asc' },
  });
}

export async function saveTrustBadges(
  context: StoreContext,
  badges: Array<{ id?: string; title: string; description: string | null; icon: string; isActive: boolean }>,
): Promise<void> {
  assertPermission(context, 'storefront.manage');

  await prisma.$transaction(async (tx) => {
    await tx.trustBadge.deleteMany({ where: { storeId: context.storeId } });
    if (badges.length === 0) return;

    await tx.trustBadge.createMany({
      data: badges.map((badge, index) => ({
        storeId: context.storeId,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
        isActive: badge.isActive,
        position: index,
      })),
    });
  });
}

// ---------------------------------------------------------------------------
// IP blacklist
// ---------------------------------------------------------------------------

export async function listBlockedIps(context: StoreContext) {
  assertPermission(context, 'settings.view');
  return prisma.blockedIp.findMany({
    where: { storeId: context.storeId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function blockIp(
  context: StoreContext,
  ip: string,
  reason: string | null,
): Promise<void> {
  assertPermission(context, 'settings.manage');

  await prisma.blockedIp.upsert({
    where: { storeId_ip: { storeId: context.storeId, ip } },
    create: { storeId: context.storeId, ip, reason, createdBy: context.actor.id },
    update: { reason },
  });

  await recordAudit(context, {
    action: 'IP_BLOCKED',
    entityType: 'blocked_ip',
    entityId: ip,
    after: { ip, reason },
  });
}

export async function unblockIp(context: StoreContext, id: string): Promise<void> {
  assertPermission(context, 'settings.manage');
  await prisma.blockedIp.deleteMany({ where: { id, storeId: context.storeId } });
}

export async function isIpBlocked(storeId: string, ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const blocked = await prisma.blockedIp.findFirst({
    where: { storeId, ip },
    select: { id: true },
  });
  return blocked !== null;
}

// ---------------------------------------------------------------------------
// Apps
// ---------------------------------------------------------------------------

export async function isAppEnabled(storeId: string, appKey: string): Promise<boolean> {
  const installation = await prisma.appInstallation.findUnique({
    where: { storeId_appKey: { storeId, appKey } },
    select: { isEnabled: true },
  });
  return installation?.isEnabled ?? false;
}

export async function listStoreApps(context: StoreContext) {
  assertPermission(context, 'apps.manage');

  const installations = await prisma.appInstallation.findMany({
    where: { storeId: context.storeId },
    select: { appKey: true, isEnabled: true },
  });
  const byKey = new Map(installations.map((row) => [row.appKey, row.isEnabled]));

  return APP_DEFINITIONS.map((app) => ({
    ...app,
    isEnabled: byKey.get(app.key) ?? app.defaultEnabled,
  }));
}

export async function setAppEnabled(
  context: StoreContext,
  appKey: string,
  isEnabled: boolean,
): Promise<void> {
  assertPermission(context, 'apps.manage');

  const definition = APP_DEFINITIONS.find((app) => app.key === appKey);
  if (!definition) throw new AppError('NOT_FOUND', 'App not found.');

  if (isEnabled && definition.requiredFeature) {
    const { assertFeature } = await import('./billing-service');
    await assertFeature(context.storeId, definition.requiredFeature as never);
  }

  await prisma.appInstallation.upsert({
    where: { storeId_appKey: { storeId: context.storeId, appKey } },
    create: { storeId: context.storeId, appKey, isEnabled },
    update: { isEnabled },
  });

  await recordAudit(context, {
    action: isEnabled ? 'APP_ENABLED' : 'APP_DISABLED',
    entityType: 'app',
    entityId: appKey,
    after: { isEnabled },
  });
}
