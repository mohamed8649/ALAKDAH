import 'server-only';

import { cache } from 'react';

import { prisma } from '@/db/client';
import { AppError } from '@/lib/errors';
import {
  getSessionAgent,
  getSessionUser,
  readActiveStoreId,
  type SessionAgent,
  type SessionUser,
} from '@/server/auth/session';

import { permissionsForRole, type Permission } from './permissions';

/**
 * The authorised tenant context.
 *
 * Nothing downstream of this module accepts a storeId from request input. A
 * service receives a `StoreContext` that was derived from the session cookie
 * and a membership row, which is the only thing that makes tenant isolation
 * real rather than advisory.
 */

export interface StoreContext {
  storeId: string;
  storeSlug: string;
  storeName: string;
  currency: string;
  timezone: string;
  country: string;
  locale: string;
  roleKey: string;
  permissions: readonly Permission[];
  actor: {
    type: 'USER' | 'AGENT';
    id: string;
    name: string;
  };
}

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  roleKey: string;
}

/** Every store the signed-in user belongs to, for the store switcher. */
export const listUserStores = cache(async (): Promise<StoreSummary[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const memberships = await prisma.storeMember.findMany({
    where: { userId: user.id, isActive: true, store: { status: { not: 'CLOSED' } } },
    select: {
      roleKey: true,
      store: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map((membership) => ({
    id: membership.store.id,
    name: membership.store.name,
    slug: membership.store.slug,
    logoUrl: membership.store.logoUrl,
    roleKey: membership.roleKey,
  }));
});

/**
 * Resolve the active store for the signed-in user.
 *
 * Returns null rather than throwing so layouts can redirect; services use
 * `requireStoreContext` which throws.
 */
export const getStoreContext = cache(async (): Promise<StoreContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const preferredId = readActiveStoreId();

  const membership =
    (preferredId
      ? await findMembership(user.id, preferredId)
      : null) ?? (await findFirstMembership(user.id));

  if (!membership) return null;

  return buildContext(membership, user);
});

async function findMembership(userId: string, storeId: string) {
  return prisma.storeMember.findFirst({
    where: { userId, storeId, isActive: true, store: { status: 'ACTIVE' } },
    select: MEMBERSHIP_SELECT,
  });
}

async function findFirstMembership(userId: string) {
  return prisma.storeMember.findFirst({
    where: { userId, isActive: true, store: { status: 'ACTIVE' } },
    select: MEMBERSHIP_SELECT,
    orderBy: { createdAt: 'asc' },
  });
}

const MEMBERSHIP_SELECT = {
  roleKey: true,
  store: {
    select: {
      id: true,
      name: true,
      slug: true,
      currency: true,
      timezone: true,
      country: true,
      defaultLocale: true,
    },
  },
} as const;

type MembershipRow = {
  roleKey: string;
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    timezone: string;
    country: string;
    defaultLocale: string;
  };
};

function buildContext(membership: MembershipRow, user: SessionUser): StoreContext {
  return {
    storeId: membership.store.id,
    storeSlug: membership.store.slug,
    storeName: membership.store.name,
    currency: membership.store.currency,
    timezone: membership.store.timezone,
    country: membership.store.country,
    locale: membership.store.defaultLocale,
    roleKey: membership.roleKey,
    permissions: permissionsForRole(membership.roleKey),
    actor: { type: 'USER', id: user.id, name: user.fullName },
  };
}

export async function requireStoreContext(): Promise<StoreContext> {
  const context = await getStoreContext();
  if (!context) throw new AppError('UNAUTHENTICATED', 'No authorised store for this session.');
  return context;
}

/**
 * Assert the actor holds a permission. This is the single choke point; services
 * call it before every mutation and every sensitive read.
 */
export function assertPermission(context: StoreContext, permission: Permission): void {
  if (!context.permissions.includes(permission)) {
    throw new AppError('FORBIDDEN', `Missing permission: ${permission}`, {
      meta: { permission },
    });
  }
}

export function hasPermission(context: StoreContext, permission: Permission): boolean {
  return context.permissions.includes(permission);
}

export async function requirePermission(permission: Permission): Promise<StoreContext> {
  const context = await requireStoreContext();
  assertPermission(context, permission);
  return context;
}

// ---------------------------------------------------------------------------
// Agent context (call-center portal)
// ---------------------------------------------------------------------------

/**
 * Build a StoreContext for a call-center agent. Agents are scoped to exactly
 * one store and carry the permission set of their role, which is narrower than
 * any merchant role.
 */
export const getAgentContext = cache(async (): Promise<StoreContext | null> => {
  const agent = await getSessionAgent();
  if (!agent) return null;

  const store = await prisma.store.findUnique({
    where: { id: agent.storeId },
    select: { currency: true, timezone: true, country: true, defaultLocale: true },
  });
  if (!store) return null;

  return {
    storeId: agent.storeId,
    storeSlug: agent.storeSlug,
    storeName: agent.storeName,
    currency: store.currency,
    timezone: store.timezone,
    country: store.country,
    locale: store.defaultLocale,
    roleKey: agent.roleKey,
    permissions: permissionsForRole(agent.roleKey),
    actor: { type: 'AGENT', id: agent.id, name: agent.fullName },
  };
});

export async function requireAgentContext(): Promise<{ context: StoreContext; agent: SessionAgent }> {
  const agent = await getSessionAgent();
  const context = await getAgentContext();
  if (!agent || !context) throw new AppError('UNAUTHENTICATED', 'Agent session required.');
  return { context, agent };
}

/**
 * Accepts either realm. Used by services shared between the merchant dashboard
 * and the agent portal (order status changes, order detail reads).
 */
export async function requireAnyContext(): Promise<StoreContext> {
  const merchant = await getStoreContext();
  if (merchant) return merchant;
  const agent = await getAgentContext();
  if (agent) return agent;
  throw new AppError('UNAUTHENTICATED', 'Authentication required.');
}
