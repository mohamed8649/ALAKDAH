import 'server-only';

import { prisma } from '@/db/client';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { enforceRateLimit, resetRateLimit } from '@/lib/rate-limit';
import {
  createAgentSession,
  createUserSession,
  revokeAllUserSessions,
  writeActiveStoreId,
} from '@/server/auth/session';
import type { AgentLoginInput } from '@/validators/agent';
import type { LoginInput, RegisterInput } from '@/validators/auth';

import { clientIp, clientUserAgent } from './audit-service';
import { seedStoreDefaults } from './store-service';

/**
 * Authentication.
 *
 * Two rules hold in both realms:
 *
 *  1. Failures are generic. "Incorrect sign-in details" is returned whether the
 *     account exists, the password is wrong, or the store slug is unknown —
 *     anything more specific lets an attacker enumerate accounts.
 *  2. Repeated failures cost time. Attempts are rate limited per identifier and
 *     the account locks temporarily after a run of failures.
 */

const MAX_FAILED_LOGINS = 6;
const LOCK_MINUTES = 15;

export async function login(input: LoginInput): Promise<void> {
  const email = input.email.toLowerCase().trim();
  enforceRateLimit('login', `${email}|${clientIp() ?? 'unknown'}`);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      failedLogins: true,
      lockedUntil: true,
    },
  });

  // A missing account still pays the hashing cost, so response time does not
  // reveal whether the email exists.
  if (!user) {
    await verifyPassword(input.password, await dummyHash());
    throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError('ACCOUNT_LOCKED', 'Account temporarily locked.');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);

  if (!valid) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil:
          failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  if (!user.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 'Account disabled.');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  resetRateLimit('login', `${email}|${clientIp() ?? 'unknown'}`);

  await createUserSession(user.id, {
    ip: clientIp() ?? undefined,
    userAgent: clientUserAgent() ?? undefined,
  });

  const membership = await prisma.storeMember.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { storeId: true },
  });
  if (membership) writeActiveStoreId(membership.storeId);
}

export async function register(input: RegisterInput): Promise<{ storeId: string }> {
  const email = input.email.toLowerCase().trim();
  enforceRateLimit('register', clientIp() ?? 'unknown');

  const [existingUser, existingStore] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.store.findUnique({ where: { slug: input.storeSlug }, select: { id: true } }),
  ]);

  if (existingUser) {
    throw new AppError('CONFLICT', 'Email already registered.', {
      fieldErrors: { email: ['validation.emailTaken'] },
    });
  }
  if (existingStore) {
    throw new AppError('SLUG_TAKEN', 'Store URL already taken.', {
      fieldErrors: { storeSlug: ['errors.SLUG_TAKEN'] },
    });
  }

  const passwordHash = await hashPassword(input.password);

  const { storeId, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, fullName: input.fullName, locale: 'ar' },
      select: { id: true },
    });

    const store = await tx.store.create({
      data: {
        slug: input.storeSlug,
        name: input.storeName,
        ownerId: user.id,
        currency: 'LYD',
        timezone: 'Africa/Tripoli',
        country: 'LY',
        defaultLocale: 'ar',
      },
      select: { id: true },
    });

    await tx.storeMember.create({
      data: { storeId: store.id, userId: user.id, roleKey: 'owner' },
    });

    return { storeId: store.id, userId: user.id };
  });

  // Checkout fields, trust badges, a default delivery method, the free plan and
  // the core apps. A brand-new store must be usable immediately.
  await seedStoreDefaults(storeId);

  await createUserSession(userId, {
    ip: clientIp() ?? undefined,
    userAgent: clientUserAgent() ?? undefined,
  });
  writeActiveStoreId(storeId);

  logger.info('store registered', { storeId, actorId: userId });

  return { storeId };
}

/**
 * Agent sign-in.
 *
 * The store identifier is part of the credential triple. A wrong store, a wrong
 * username and a wrong password all produce the same error.
 */
export async function agentLogin(input: AgentLoginInput): Promise<void> {
  const identifier = input.storeIdentifier.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  enforceRateLimit('agentLogin', `${identifier}|${username}|${clientIp() ?? 'unknown'}`);

  const store = await prisma.store.findFirst({
    where: { OR: [{ slug: identifier }, { id: input.storeIdentifier.trim() }] },
    select: { id: true, status: true },
  });

  if (!store || store.status !== 'ACTIVE') {
    await verifyPassword(input.password, await dummyHash());
    throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  const agent = await prisma.agent.findFirst({
    where: { storeId: store.id, username, archivedAt: null },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      failedLogins: true,
      lockedUntil: true,
    },
  });

  if (!agent) {
    await verifyPassword(input.password, await dummyHash());
    throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  if (agent.lockedUntil && agent.lockedUntil > new Date()) {
    throw new AppError('ACCOUNT_LOCKED', 'Account temporarily locked.');
  }

  const valid = await verifyPassword(input.password, agent.passwordHash);

  if (!valid) {
    const failed = agent.failedLogins + 1;
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        failedLogins: failed,
        lockedUntil:
          failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  // A disabled agent is told their account is disabled only after proving the
  // password: the message is useful to them and useless to an attacker.
  if (!agent.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 'Account disabled.');
  }

  await prisma.agent.update({
    where: { id: agent.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await createAgentSession(agent.id, {
    ip: clientIp() ?? undefined,
    userAgent: clientUserAgent() ?? undefined,
  });
}

let cachedDummyHash: string | null = null;

async function dummyHash(): Promise<string> {
  cachedDummyHash ??= await hashPassword('timing-equalisation-placeholder');
  return cachedDummyHash;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface ProfileInput {
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  locale: 'ar' | 'en';
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: input.fullName,
      phone: input.phone,
      avatarUrl: input.avatarUrl,
      locale: input.locale,
    },
  });
}

/**
 * Change a password.
 *
 * The current password is required even though the caller is already signed
 * in: a session left open on a shared machine should not be enough to lock the
 * real owner out. Every other session is revoked afterwards, because the point
 * of changing a password is usually that someone else may have had it.
 */
export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  enforceRateLimit('login', `pw:${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new AppError('UNAUTHENTICATED', 'Not signed in.');

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError('VALIDATION_FAILED', 'Incorrect password.', {
      fieldErrors: { currentPassword: ['validation.incorrectPassword'] },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });

  await revokeAllUserSessions(userId);
  resetRateLimit('login', `pw:${userId}`);
}
