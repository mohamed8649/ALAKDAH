import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { prisma } from '@/db/client';
import { generateSessionToken, hashToken } from '@/lib/crypto';

/**
 * Session management for the two authentication realms.
 *
 * Merchant users and call-center agents are separate principals with separate
 * cookies, separate tables and separate lifetimes. An agent token can never be
 * presented as a merchant token because they are looked up in different tables.
 */

export const USER_COOKIE = 'akd_session';
export const AGENT_COOKIE = 'akd_agent_session';
export const ACTIVE_STORE_COOKIE = 'akd_store';

const USER_SESSION_DAYS = 14;
const AGENT_SESSION_HOURS = 12;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

// ---------------------------------------------------------------------------
// Merchant / staff sessions
// ---------------------------------------------------------------------------

export async function createUserSession(
  userId: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + USER_SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 255) ?? null,
    },
  });

  cookies().set(USER_COOKIE, token, cookieOptions(expiresAt));
}

export async function destroyUserSession(): Promise<void> {
  const token = cookies().get(USER_COOKIE)?.value;
  if (token) {
    await prisma.userSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookies().delete(USER_COOKIE);
  cookies().delete(ACTIVE_STORE_COOKIE);
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
}

/**
 * Resolve the signed-in merchant user. Deduplicated per request by React cache
 * so a page rendering ten server components issues one query.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = cookies().get(USER_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: {
        select: { id: true, email: true, fullName: true, avatarUrl: true, locale: true, isActive: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    avatarUrl: session.user.avatarUrl,
    locale: session.user.locale,
  };
});

// ---------------------------------------------------------------------------
// Call-center agent sessions
// ---------------------------------------------------------------------------

export async function createAgentSession(
  agentId: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + AGENT_SESSION_HOURS * 60 * 60 * 1000);

  await prisma.agentSession.create({
    data: {
      agentId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 255) ?? null,
    },
  });

  cookies().set(AGENT_COOKIE, token, cookieOptions(expiresAt));
}

export async function destroyAgentSession(): Promise<void> {
  const token = cookies().get(AGENT_COOKIE)?.value;
  if (token) {
    await prisma.agentSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookies().delete(AGENT_COOKIE);
}

export interface SessionAgent {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  fullName: string;
  username: string;
  roleKey: string;
}

export const getSessionAgent = cache(async (): Promise<SessionAgent | null> => {
  const token = cookies().get(AGENT_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.agentSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      agent: {
        select: {
          id: true,
          storeId: true,
          fullName: true,
          username: true,
          roleKey: true,
          isActive: true,
          archivedAt: true,
          store: { select: { name: true, slug: true, status: true } },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const agent = session.agent;
  if (!agent.isActive || agent.archivedAt || agent.store.status !== 'ACTIVE') return null;

  return {
    id: agent.id,
    storeId: agent.storeId,
    storeName: agent.store.name,
    storeSlug: agent.store.slug,
    fullName: agent.fullName,
    username: agent.username,
    roleKey: agent.roleKey,
  };
});

// ---------------------------------------------------------------------------
// Active store selection
// ---------------------------------------------------------------------------

export function readActiveStoreId(): string | null {
  return cookies().get(ACTIVE_STORE_COOKIE)?.value ?? null;
}

export function writeActiveStoreId(storeId: string): void {
  cookies().set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Revoke every active session for a user — used when disabling an account. */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllAgentSessions(agentId: string): Promise<void> {
  await prisma.agentSession.updateMany({
    where: { agentId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
