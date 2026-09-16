import 'server-only';

import { headers } from 'next/headers';

import type { DbClient } from '@/db/client';
import { prisma } from '@/db/client';
import { logger } from '@/lib/logger';
import type { StoreContext } from '@/server/policies/context';

/**
 * Audit trail.
 *
 * Every sensitive mutation records who did what to which entity, with the before
 * and after state where that is meaningful. Audit writes join the caller's
 * transaction so a rolled-back mutation never leaves a log entry claiming it
 * happened.
 */

export const AUDIT_ACTIONS = [
  'ORDER_CREATED',
  'ORDER_STATUS_CHANGED',
  'ORDER_UPDATED',
  'ORDER_EXPORTED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_DELETED',
  'INVENTORY_ADJUSTED',
  'AGENT_CREATED',
  'AGENT_UPDATED',
  'AGENT_DELETED',
  'AGENT_CREDENTIALS_RESET',
  'TOKEN_CREATED',
  'TOKEN_REVOKED',
  'SHIPPING_RULE_CHANGED',
  'SHIPPING_METHOD_CHANGED',
  'INTEGRATION_CONNECTED',
  'INTEGRATION_DISCONNECTED',
  'IMPORT_COMPLETED',
  'PIXEL_UPDATED',
  'SETTINGS_UPDATED',
  'STAFF_ROLE_CHANGED',
  'STAFF_REMOVED',
  'THEME_ACTIVATED',
  'PAGE_PUBLISHED',
  'CAMPAIGN_CREATED',
  'IP_BLOCKED',
  'APP_ENABLED',
  'APP_DISABLED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(
  context: StoreContext,
  input: AuditInput,
  db: DbClient = prisma,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        storeId: context.storeId,
        actorType: context.actor.type,
        actorId: context.actor.id,
        actorName: context.actor.name,
        userId: context.actor.type === 'USER' ? context.actor.id : null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: toJson(input.before),
        after: toJson(input.after),
        metadata: toJson(input.metadata),
        ip: clientIp(),
      },
    });
  } catch (error) {
    // An audit failure must never roll back the business action that succeeded.
    logger.error('audit write failed', error, {
      storeId: context.storeId,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
    });
  }
}

/** System-initiated audit entry with no signed-in actor. */
export async function recordSystemAudit(
  storeId: string,
  input: AuditInput,
  db: DbClient = prisma,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        storeId,
        actorType: 'SYSTEM',
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: toJson(input.before),
        after: toJson(input.after),
        metadata: toJson(input.metadata),
      },
    });
  } catch (error) {
    logger.error('system audit write failed', error, { storeId });
  }
}

function toJson(value: unknown) {
  if (value === undefined || value === null) return undefined;
  // Prisma Json columns reject undefined nested values; round-tripping strips them.
  return JSON.parse(JSON.stringify(value)) as object;
}

export function clientIp(): string | null {
  try {
    const list = headers();
    const forwarded = list.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
    return list.get('x-real-ip');
  } catch {
    // Called outside a request scope (a background job).
    return null;
  }
}

export function clientUserAgent(): string | null {
  try {
    return headers().get('user-agent');
  } catch {
    return null;
  }
}
