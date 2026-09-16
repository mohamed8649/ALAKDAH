import 'server-only';

import { prisma } from '@/db/client';
import { generateAccessToken, hashToken } from '@/lib/crypto';
import { AppError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import { PERMISSIONS } from '@/server/policies/permissions';

import { recordAudit } from './audit-service';

/**
 * Access tokens.
 *
 * The plaintext token exists for exactly one response. Only its SHA-256 digest
 * is stored, so a database leak yields nothing usable and "show me the token
 * again" is genuinely impossible rather than merely discouraged.
 *
 * REBUILD PROPOSAL — the reference shows token creation with scope selection.
 * Scopes here reuse the same permission vocabulary as roles, so a token can
 * never be granted a capability the platform does not otherwise model.
 */

export const TOKEN_SCOPES = PERMISSIONS;

export async function listAccessTokens(context: StoreContext) {
  assertPermission(context, 'tokens.manage');

  return prisma.accessToken.findMany({
    where: { storeId: context.storeId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

export interface CreatedToken {
  id: string;
  /** Shown once, never retrievable again. */
  plaintext: string;
  prefix: string;
}

export async function createAccessToken(
  context: StoreContext,
  input: { name: string; scopes: string[]; expiresInDays: number },
): Promise<CreatedToken> {
  assertPermission(context, 'tokens.manage');
  enforceRateLimit('tokenCreate', context.storeId);

  // A token may never exceed the permissions of the member minting it —
  // otherwise token creation becomes a privilege-escalation path.
  const allowed = input.scopes.filter((scope) =>
    (context.permissions as readonly string[]).includes(scope),
  );

  if (allowed.length === 0) {
    throw new AppError('FORBIDDEN', 'No scopes available to this role.', {
      fieldErrors: { scopes: ['validation.selectAtLeastOne'] },
    });
  }

  const generated = generateAccessToken();

  const token = await prisma.accessToken.create({
    data: {
      storeId: context.storeId,
      name: input.name,
      prefix: generated.prefix,
      hashedToken: generated.hashedToken,
      scopes: allowed,
      createdBy: context.actor.id,
      expiresAt:
        input.expiresInDays > 0
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null,
    },
    select: { id: true },
  });

  await recordAudit(context, {
    action: 'TOKEN_CREATED',
    entityType: 'access_token',
    entityId: token.id,
    // The token value is deliberately absent from the audit payload.
    after: { name: input.name, scopes: allowed, prefix: generated.prefix },
  });

  return { id: token.id, plaintext: generated.plaintext, prefix: generated.prefix };
}

export async function revokeAccessToken(context: StoreContext, tokenId: string): Promise<void> {
  assertPermission(context, 'tokens.manage');

  const result = await prisma.accessToken.updateMany({
    where: { id: tokenId, storeId: context.storeId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Token not found.');

  await recordAudit(context, {
    action: 'TOKEN_REVOKED',
    entityType: 'access_token',
    entityId: tokenId,
  });
}

/**
 * Authenticate a bearer token.
 *
 * Looks up by digest, so the plaintext is never compared against stored data.
 * Returns null for anything revoked, expired or unknown — the caller cannot
 * distinguish which, by design.
 */
export async function authenticateToken(
  plaintext: string,
): Promise<{ storeId: string; scopes: string[] } | null> {
  if (!plaintext.startsWith('akd_')) return null;

  const token = await prisma.accessToken.findUnique({
    where: { hashedToken: hashToken(plaintext) },
    select: { id: true, storeId: true, scopes: true, revokedAt: true, expiresAt: true },
  });

  if (!token || token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt < new Date()) return null;

  // Best-effort last-used stamp; a failure here must not reject a valid token.
  void prisma.accessToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { storeId: token.storeId, scopes: token.scopes };
}
