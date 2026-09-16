import 'server-only';

import { prisma } from '@/db/client';
import { AppError } from '@/lib/errors';
import { assertPermission, type StoreContext } from '@/server/policies/context';

import { recordAudit } from './audit-service';

/**
 * Plans, entitlements and usage.
 *
 * Entitlement checks run on the server before the action, not in the component
 * that renders the button. Hiding a control is presentation; this is the
 * enforcement.
 */

export const PLAN_FEATURES = [
  'pixels',
  'integrations',
  'abandoned_recovery',
  'ai_tools',
  'landing_pages',
  'call_center',
  'themes',
  'custom_domain',
  'api_access',
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURES)[number];

export const PLAN_LIMITS = [
  'orders',
  'products',
  'agents',
  'landing_pages',
  'ai_credits',
  'abandoned_recovery',
  'staff',
  'pixels',
  'integrations',
] as const;

export type PlanLimitKey = (typeof PLAN_LIMITS)[number];

const UNLIMITED = -1;

export interface Entitlements {
  planKey: string;
  planName: string;
  status: string;
  features: Set<string>;
  limits: Map<string, number>;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Resolve the store's entitlements.
 *
 * A store with no subscription row falls back to the free "payg" plan rather
 * than being locked out: an operational store must keep taking orders even if
 * its billing record is missing.
 */
export async function getEntitlements(storeId: string): Promise<Entitlements> {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    include: {
      plan: { include: { features: true, limits: true } },
    },
  });

  if (!subscription) {
    const fallback = await prisma.plan.findFirst({
      where: { isPayg: true },
      include: { features: true, limits: true },
    });

    const now = new Date();
    return {
      planKey: fallback?.key ?? 'payg',
      planName: fallback?.nameAr ?? 'PAYG',
      status: 'ACTIVE',
      features: new Set(fallback?.features.filter((f) => f.enabled).map((f) => f.featureKey) ?? []),
      limits: new Map(fallback?.limits.map((l) => [l.limitKey, l.value]) ?? []),
      currentPeriodStart: startOfMonth(now),
      currentPeriodEnd: endOfMonth(now),
    };
  }

  return {
    planKey: subscription.planKey,
    planName: subscription.plan.nameAr,
    status: subscription.status,
    features: new Set(subscription.plan.features.filter((f) => f.enabled).map((f) => f.featureKey)),
    limits: new Map(subscription.plan.limits.map((l) => [l.limitKey, l.value])),
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

export async function hasFeature(storeId: string, feature: PlanFeatureKey): Promise<boolean> {
  const entitlements = await getEntitlements(storeId);
  return entitlements.features.has(feature);
}

export async function assertFeature(storeId: string, feature: PlanFeatureKey): Promise<void> {
  if (!(await hasFeature(storeId, feature))) {
    throw new AppError('FEATURE_NOT_IN_PLAN', `Feature not in plan: ${feature}`, {
      meta: { feature },
    });
  }
}

export interface UsageSnapshot {
  limitKey: string;
  used: number;
  limit: number;
  /** Extra allowance purchased as an add-on. */
  addOnAllowance: number;
  remaining: number;
  unlimited: boolean;
}

/**
 * Current usage for a limit. Counted live from the source tables rather than a
 * cached counter — correctness beats a saved query at this scale, and a drifted
 * counter that silently blocks a merchant is worse than a slightly slower page.
 */
export async function getUsage(storeId: string, limitKey: PlanLimitKey): Promise<UsageSnapshot> {
  const entitlements = await getEntitlements(storeId);
  const limit = entitlements.limits.get(limitKey) ?? UNLIMITED;
  const addOnAllowance = await addOnAllowanceFor(storeId, limitKey);
  const used = await countUsage(storeId, limitKey, entitlements);

  const unlimited = limit === UNLIMITED;
  const effectiveLimit = unlimited ? UNLIMITED : limit + addOnAllowance;

  return {
    limitKey,
    used,
    limit: effectiveLimit,
    addOnAllowance,
    remaining: unlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, effectiveLimit - used),
    unlimited,
  };
}

export async function assertWithinLimit(storeId: string, limitKey: PlanLimitKey): Promise<void> {
  const usage = await getUsage(storeId, limitKey);
  if (usage.unlimited) return;
  if (usage.used >= usage.limit) {
    throw new AppError('PLAN_LIMIT_REACHED', `Plan limit reached: ${limitKey}`, {
      meta: { limitKey, limit: usage.limit, used: usage.used },
    });
  }
}

async function countUsage(
  storeId: string,
  limitKey: PlanLimitKey,
  entitlements: Entitlements,
): Promise<number> {
  switch (limitKey) {
    case 'orders':
      return prisma.order.count({
        where: {
          storeId,
          createdAt: { gte: entitlements.currentPeriodStart, lte: entitlements.currentPeriodEnd },
        },
      });
    case 'products':
      return prisma.product.count({ where: { storeId, archivedAt: null } });
    case 'agents':
      return prisma.agent.count({ where: { storeId, archivedAt: null } });
    case 'landing_pages':
      return prisma.landingPage.count({ where: { storeId, archivedAt: null } });
    case 'staff':
      return prisma.storeMember.count({ where: { storeId, isActive: true } });
    case 'pixels':
      return prisma.pixelIntegration.count({ where: { storeId, isActive: true } });
    case 'integrations':
      return prisma.integrationConnection.count({ where: { storeId, status: 'CONNECTED' } });
    case 'ai_credits':
      return prisma.aiGeneration.aggregate({
        where: {
          storeId,
          status: 'SUCCEEDED',
          createdAt: { gte: entitlements.currentPeriodStart, lte: entitlements.currentPeriodEnd },
        },
        _sum: { creditsUsed: true },
      }).then((result) => result._sum.creditsUsed ?? 0);
    case 'abandoned_recovery':
      return prisma.abandonedCheckout.count({
        where: {
          storeId,
          status: 'RECOVERED',
          updatedAt: { gte: entitlements.currentPeriodStart, lte: entitlements.currentPeriodEnd },
        },
      });
    default:
      return 0;
  }
}

async function addOnAllowanceFor(storeId: string, limitKey: string): Promise<number> {
  const purchases = await prisma.addOnPurchase.findMany({
    where: { subscription: { storeId }, addOn: { limitKey } },
    select: { remaining: true },
  });
  return purchases.reduce((total, purchase) => total + purchase.remaining, 0);
}

export async function getAllUsage(storeId: string): Promise<UsageSnapshot[]> {
  const entitlements = await getEntitlements(storeId);
  const keys = [...entitlements.limits.keys()].filter((key): key is PlanLimitKey =>
    (PLAN_LIMITS as readonly string[]).includes(key),
  );
  return Promise.all(keys.map((key) => getUsage(storeId, key)));
}

export async function listPlans() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
    include: { features: true, limits: true },
  });
}

export async function listAddOns() {
  return prisma.addOn.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } });
}

export async function getSubscription(storeId: string) {
  return prisma.subscription.findUnique({
    where: { storeId },
    include: { plan: { include: { features: true, limits: true } }, addOns: { include: { addOn: true } } },
  });
}

/**
 * REBUILD PROPOSAL — plan changes are recorded locally with no payment
 * processor attached. Wiring a gateway means replacing this one function; the
 * entitlement machinery above does not change.
 */
export async function changePlan(
  context: StoreContext,
  planKey: string,
  interval: 'MONTHLY' | 'YEARLY',
): Promise<void> {
  assertPermission(context, 'billing.manage');

  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.isActive) throw new AppError('NOT_FOUND', 'Plan not found.');

  const now = new Date();
  const periodEnd =
    interval === 'YEARLY'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : endOfMonth(now);

  const previous = await prisma.subscription.findUnique({
    where: { storeId: context.storeId },
    select: { planKey: true },
  });

  await prisma.subscription.upsert({
    where: { storeId: context.storeId },
    create: {
      storeId: context.storeId,
      planKey,
      interval,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      planKey,
      interval,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  await recordAudit(context, {
    action: 'SETTINGS_UPDATED',
    entityType: 'subscription',
    entityId: context.storeId,
    before: { planKey: previous?.planKey ?? null },
    after: { planKey, interval },
  });
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}
