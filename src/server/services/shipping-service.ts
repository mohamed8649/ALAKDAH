import 'server-only';

import { prisma, type DbClient } from '@/db/client';
import {
  matchShippingRule,
  resolveShippingPrice,
  findOverlappingRules,
  type RuleContext,
  type ShippingMethodType,
} from '@/features/shipping/rules';
import { decryptJson, encryptJson } from '@/lib/crypto';
import { AppError } from '@/lib/errors';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import { getProvider, listProviderDefinitions } from '@/server/integrations/shipping';
import type {
  DeliverySlipInput,
  ShippingMethodInput,
  ShippingProviderInput,
  ShippingRuleInput,
} from '@/validators/shipping';

import { recordAudit } from './audit-service';

/**
 * Shipping service.
 *
 * Carrier credentials are encrypted at rest with AES-256-GCM and never leave
 * the server after they are saved. The UI shows connection state and a masked
 * hint, never the secret.
 */

// ---------------------------------------------------------------------------
// Methods & zones
// ---------------------------------------------------------------------------

export async function listShippingMethods(context: StoreContext) {
  assertPermission(context, 'shipping.view');

  return prisma.shippingMethod.findMany({
    where: { storeId: context.storeId, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { zones: { orderBy: { position: 'asc' } } },
  });
}

/** Methods a customer can actually choose at checkout. */
export async function listPublicShippingMethods(storeId: string) {
  return prisma.shippingMethod.findMany({
    where: { storeId, archivedAt: null, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    include: { zones: { orderBy: { position: 'asc' } } },
  });
}

export async function saveShippingMethod(
  context: StoreContext,
  methodId: string | null,
  input: ShippingMethodInput,
): Promise<{ id: string }> {
  assertPermission(context, 'shipping.manage');

  const result = await prisma.$transaction(async (tx) => {
    const data = {
      name: input.name,
      nameEn: input.nameEn || null,
      description: input.description || null,
      type: input.type,
      price: input.price ?? 0,
      isActive: input.isActive,
      isDefault: input.isDefault,
      supportsCod: input.supportsCod,
      minDeliveryDays: input.minDeliveryDays ?? null,
      maxDeliveryDays: input.maxDeliveryDays ?? null,
    };

    let method: { id: string };

    if (methodId) {
      const existing = await tx.shippingMethod.findFirst({
        where: { id: methodId, storeId: context.storeId },
        select: { id: true },
      });
      if (!existing) throw new AppError('NOT_FOUND', 'Delivery method not found.');

      method = await tx.shippingMethod.update({
        where: { id: methodId },
        data,
        select: { id: true },
      });
      await tx.shippingZone.deleteMany({ where: { methodId, storeId: context.storeId } });
    } else {
      method = await tx.shippingMethod.create({
        data: { ...data, storeId: context.storeId },
        select: { id: true },
      });
    }

    // Exactly one default method: promoting one demotes the rest.
    if (input.isDefault) {
      await tx.shippingMethod.updateMany({
        where: { storeId: context.storeId, NOT: { id: method.id } },
        data: { isDefault: false },
      });
    }

    for (const [index, zone] of input.zones.entries()) {
      await tx.shippingZone.create({
        data: {
          storeId: context.storeId,
          methodId: method.id,
          name: zone.name,
          price: zone.price ?? 0,
          regions: zone.regions,
          cities: zone.cities,
          position: index,
        },
      });
    }

    return method;
  });

  await recordAudit(context, {
    action: 'SHIPPING_METHOD_CHANGED',
    entityType: 'shipping_method',
    entityId: result.id,
    after: { name: input.name, price: input.price, zones: input.zones.length },
  });

  return result;
}

export async function archiveShippingMethod(
  context: StoreContext,
  methodId: string,
): Promise<void> {
  assertPermission(context, 'shipping.manage');

  const result = await prisma.shippingMethod.updateMany({
    where: { id: methodId, storeId: context.storeId },
    data: { archivedAt: new Date(), isActive: false, isDefault: false },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Delivery method not found.');

  await recordAudit(context, {
    action: 'SHIPPING_METHOD_CHANGED',
    entityType: 'shipping_method',
    entityId: methodId,
    after: { archived: true },
  });
}

export interface ShippingQuote {
  methodId: string;
  methodName: string;
  type: ShippingMethodType;
  price: number;
  zoneName: string | null;
  supportsCod: boolean;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
}

/** Quote every available method for a destination. Used by checkout. */
export async function quoteShipping(
  storeId: string,
  destination: { state: string; city: string },
): Promise<ShippingQuote[]> {
  const methods = await listPublicShippingMethods(storeId);

  return methods.map((method) => {
    const resolved = resolveShippingPrice(
      { id: method.id, price: method.price, zones: method.zones },
      destination,
    );

    return {
      methodId: method.id,
      methodName: method.name,
      type: method.type as ShippingMethodType,
      price: method.type === 'PICKUP' ? 0 : resolved.price,
      zoneName: resolved.zoneName,
      supportsCod: method.supportsCod,
      minDeliveryDays: method.minDeliveryDays,
      maxDeliveryDays: method.maxDeliveryDays,
    };
  });
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export interface ProviderCard {
  id: string | null;
  providerKey: string;
  name: string;
  descriptionAr: string;
  logo: string;
  isConnected: boolean;
  isActive: boolean;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  credentialFields: ReadonlyArray<{ key: string; labelAr: string; secret: boolean }>;
}

export async function listProviders(context: StoreContext): Promise<ProviderCard[]> {
  assertPermission(context, 'shipping.view');

  const connections = await prisma.shippingProvider.findMany({
    where: { storeId: context.storeId, archivedAt: null },
  });
  const byKey = new Map(connections.map((row) => [row.providerKey, row]));

  return listProviderDefinitions().map((definition) => {
    const connection = byKey.get(definition.key);
    return {
      id: connection?.id ?? null,
      providerKey: definition.key,
      name: connection?.name ?? definition.nameAr,
      descriptionAr: definition.descriptionAr,
      logo: definition.logo,
      isConnected: connection?.isConnected ?? false,
      isActive: connection?.isActive ?? true,
      lastTestedAt: connection?.lastTestedAt ?? null,
      lastTestStatus: connection?.lastTestStatus ?? null,
      lastTestMessage: connection?.lastTestMessage ?? null,
      credentialFields: definition.credentialFields,
    };
  });
}

export async function connectProvider(
  context: StoreContext,
  input: ShippingProviderInput,
): Promise<{ id: string }> {
  assertPermission(context, 'shipping.manage');

  const definition = getProvider(input.providerKey);
  if (!definition) throw new AppError('NOT_FOUND', 'Unknown carrier.');

  const credentials = {
    apiKey: input.apiKey || '',
    apiSecret: input.apiSecret || '',
    accountId: input.accountId || '',
    baseUrl: input.baseUrl || '',
  };

  const provider = await prisma.shippingProvider.upsert({
    where: { storeId_providerKey: { storeId: context.storeId, providerKey: input.providerKey } },
    create: {
      storeId: context.storeId,
      providerKey: input.providerKey,
      name: input.name,
      isConnected: true,
      isActive: true,
      credentialsEncrypted: encryptJson(credentials),
    },
    update: {
      name: input.name,
      isConnected: true,
      isActive: true,
      archivedAt: null,
      credentialsEncrypted: encryptJson(credentials),
    },
    select: { id: true },
  });

  await recordAudit(context, {
    action: 'INTEGRATION_CONNECTED',
    entityType: 'shipping_provider',
    entityId: provider.id,
    // Credentials are deliberately absent from the audit payload.
    after: { providerKey: input.providerKey, name: input.name },
  });

  return provider;
}

export async function disconnectProvider(context: StoreContext, providerId: string): Promise<void> {
  assertPermission(context, 'shipping.manage');

  const provider = await prisma.shippingProvider.findFirst({
    where: { id: providerId, storeId: context.storeId },
    select: { id: true, providerKey: true },
  });
  if (!provider) throw new AppError('NOT_FOUND', 'Carrier not found.');

  await prisma.$transaction(async (tx) => {
    await tx.shippingProvider.update({
      where: { id: providerId },
      data: { isConnected: false, isActive: false, credentialsEncrypted: null },
    });
    await tx.shippingRule.deleteMany({ where: { providerId, storeId: context.storeId } });
  });

  await recordAudit(context, {
    action: 'INTEGRATION_DISCONNECTED',
    entityType: 'shipping_provider',
    entityId: providerId,
    before: { providerKey: provider.providerKey },
  });
}

export async function testProviderConnection(
  context: StoreContext,
  providerId: string,
): Promise<{ ok: boolean; message: string }> {
  assertPermission(context, 'shipping.manage');

  const connection = await prisma.shippingProvider.findFirst({
    where: { id: providerId, storeId: context.storeId },
  });
  if (!connection) throw new AppError('NOT_FOUND', 'Carrier not found.');

  const definition = getProvider(connection.providerKey);
  if (!definition) throw new AppError('NOT_FOUND', 'Unknown carrier.');

  const credentials = connection.credentialsEncrypted
    ? decryptJson<Record<string, string>>(connection.credentialsEncrypted)
    : null;

  const result = await definition.validate(credentials ?? {});

  await prisma.shippingProvider.update({
    where: { id: providerId },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result.ok ? 'ok' : 'error',
      lastTestMessage: result.message.slice(0, 300),
      isConnected: result.ok,
    },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Assignment rules
// ---------------------------------------------------------------------------

export async function listShippingRules(context: StoreContext) {
  assertPermission(context, 'shipping.view');

  const rules = await prisma.shippingRule.findMany({
    where: { storeId: context.storeId },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    include: { provider: { select: { id: true, name: true, isConnected: true } } },
  });

  const overlaps = findOverlappingRules(
    rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      isActive: rule.isActive,
      matchState: rule.matchState,
      matchCity: rule.matchCity,
      matchMinTotal: rule.matchMinTotal,
      matchMaxTotal: rule.matchMaxTotal,
      matchMethodType: rule.matchMethodType as ShippingMethodType | null,
      providerId: rule.providerId,
    })),
  );

  return { rules, overlaps: overlaps.map(([a, b]) => ({ a: a.name, b: b.name })) };
}

export async function saveShippingRule(
  context: StoreContext,
  ruleId: string | null,
  input: ShippingRuleInput,
): Promise<{ id: string }> {
  assertPermission(context, 'shipping.manage');

  const provider = await prisma.shippingProvider.findFirst({
    where: { id: input.providerId, storeId: context.storeId, archivedAt: null },
    select: { id: true },
  });
  if (!provider) throw new AppError('NOT_FOUND', 'Carrier not found.');

  const data = {
    name: input.name,
    priority: input.priority,
    isActive: input.isActive,
    matchState: input.matchState || null,
    matchCity: input.matchCity || null,
    matchMinTotal: input.matchMinTotal ?? null,
    matchMaxTotal: input.matchMaxTotal ?? null,
    matchMethodType: (input.matchMethodType || null) as ShippingMethodType | null,
    providerId: input.providerId,
  };

  const rule = ruleId
    ? await prisma.shippingRule
        .updateMany({ where: { id: ruleId, storeId: context.storeId }, data })
        .then(async (result) => {
          if (result.count === 0) throw new AppError('NOT_FOUND', 'Rule not found.');
          return { id: ruleId };
        })
    : await prisma.shippingRule.create({
        data: { ...data, storeId: context.storeId },
        select: { id: true },
      });

  await recordAudit(context, {
    action: 'SHIPPING_RULE_CHANGED',
    entityType: 'shipping_rule',
    entityId: rule.id,
    after: { name: input.name, providerId: input.providerId, priority: input.priority },
  });

  return rule;
}

export async function deleteShippingRule(context: StoreContext, ruleId: string): Promise<void> {
  assertPermission(context, 'shipping.manage');

  const result = await prisma.shippingRule.deleteMany({
    where: { id: ruleId, storeId: context.storeId },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Rule not found.');

  await recordAudit(context, {
    action: 'SHIPPING_RULE_CHANGED',
    entityType: 'shipping_rule',
    entityId: ruleId,
    after: { deleted: true },
  });
}

/** Pick the carrier for a new order. Returns null when nothing matches. */
export async function resolveProviderForOrder(
  db: DbClient,
  storeId: string,
  context: RuleContext,
): Promise<string | null> {
  const rules = await db.shippingRule.findMany({
    where: { storeId, isActive: true, provider: { isConnected: true, archivedAt: null } },
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
  });

  const match = matchShippingRule(
    rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      isActive: rule.isActive,
      matchState: rule.matchState,
      matchCity: rule.matchCity,
      matchMinTotal: rule.matchMinTotal,
      matchMaxTotal: rule.matchMaxTotal,
      matchMethodType: rule.matchMethodType as ShippingMethodType | null,
      providerId: rule.providerId,
    })),
    context,
  );

  return match?.providerId ?? null;
}

// ---------------------------------------------------------------------------
// Delivery slip
// ---------------------------------------------------------------------------

export async function getDeliverySlipConfig(storeId: string) {
  const config = await prisma.deliverySlipConfig.findUnique({ where: { storeId } });
  if (config) return config;

  return prisma.deliverySlipConfig.create({ data: { storeId } });
}

export async function saveDeliverySlipConfig(
  context: StoreContext,
  input: DeliverySlipInput,
): Promise<void> {
  assertPermission(context, 'shipping.manage');

  await prisma.deliverySlipConfig.upsert({
    where: { storeId: context.storeId },
    create: { storeId: context.storeId, ...input, footerNote: input.footerNote || null },
    update: { ...input, footerNote: input.footerNote || null },
  });

  await recordAudit(context, {
    action: 'SETTINGS_UPDATED',
    entityType: 'delivery_slip',
    entityId: context.storeId,
    after: input as unknown as Record<string, unknown>,
  });
}
