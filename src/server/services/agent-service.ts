import 'server-only';

import { prisma, type DbClient } from '@/db/client';
import { hashPassword } from '@/lib/crypto';
import { AppError } from '@/lib/errors';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import { revokeAllAgentSessions } from '@/server/auth/session';
import type { AgentInput, AgentRuleInput } from '@/validators/agent';

import { recordAudit } from './audit-service';
import { assertWithinLimit } from './billing-service';

/**
 * Call-center agents and automatic assignment.
 *
 * An agent is a separate principal from a merchant user: their own table, their
 * own credentials, their own session cookie, and a permission set that only
 * reaches the orders assigned to them.
 */

export async function listAgents(context: StoreContext) {
  assertPermission(context, 'callcenter.view');

  const agents = await prisma.agent.findMany({
    where: { storeId: context.storeId, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      email: true,
      username: true,
      isActive: true,
      roleKey: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  return agents.map((agent) => ({
    id: agent.id,
    fullName: agent.fullName,
    email: agent.email,
    username: agent.username,
    isActive: agent.isActive,
    roleKey: agent.roleKey,
    lastLoginAt: agent.lastLoginAt,
    createdAt: agent.createdAt,
    ordersCount: agent._count.orders,
  }));
}

export async function createAgent(
  context: StoreContext,
  input: AgentInput,
): Promise<{ id: string; username: string }> {
  assertPermission(context, 'callcenter.manage');
  await assertWithinLimit(context.storeId, 'agents');

  const existing = await prisma.agent.findFirst({
    where: { storeId: context.storeId, username: input.username },
    select: { id: true },
  });
  if (existing) {
    throw new AppError('CONFLICT', 'Username already taken.', {
      fieldErrors: { username: ['validation.usernameTaken'] },
    });
  }

  if (!input.password) {
    throw new AppError('VALIDATION_FAILED', 'Password required.', {
      fieldErrors: { password: ['validation.required'] },
    });
  }

  const agent = await prisma.agent.create({
    data: {
      storeId: context.storeId,
      fullName: input.fullName,
      email: input.email || null,
      username: input.username,
      passwordHash: await hashPassword(input.password),
      isActive: input.isActive,
      roleKey: input.roleKey,
    },
    select: { id: true, username: true },
  });

  await recordAudit(context, {
    action: 'AGENT_CREATED',
    entityType: 'agent',
    entityId: agent.id,
    after: { username: agent.username, fullName: input.fullName },
  });

  return agent;
}

export async function updateAgent(
  context: StoreContext,
  agentId: string,
  input: AgentInput,
): Promise<void> {
  assertPermission(context, 'callcenter.manage');

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, storeId: context.storeId, archivedAt: null },
    select: { id: true, fullName: true, username: true, isActive: true },
  });
  if (!agent) throw new AppError('NOT_FOUND', 'Agent not found.');

  if (input.username !== agent.username) {
    const clash = await prisma.agent.findFirst({
      where: { storeId: context.storeId, username: input.username, NOT: { id: agentId } },
      select: { id: true },
    });
    if (clash) {
      throw new AppError('CONFLICT', 'Username already taken.', {
        fieldErrors: { username: ['validation.usernameTaken'] },
      });
    }
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      fullName: input.fullName,
      email: input.email || null,
      username: input.username,
      isActive: input.isActive,
      roleKey: input.roleKey,
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
    },
  });

  // Deactivating an agent must end their live session, not just block the next
  // sign-in.
  if (!input.isActive && agent.isActive) {
    await revokeAllAgentSessions(agentId);
  }

  await recordAudit(context, {
    action: input.password ? 'AGENT_CREDENTIALS_RESET' : 'AGENT_UPDATED',
    entityType: 'agent',
    entityId: agentId,
    before: { fullName: agent.fullName, username: agent.username, isActive: agent.isActive },
    after: { fullName: input.fullName, username: input.username, isActive: input.isActive },
  });
}

export async function setAgentActive(
  context: StoreContext,
  agentId: string,
  isActive: boolean,
): Promise<void> {
  assertPermission(context, 'callcenter.manage');

  const result = await prisma.agent.updateMany({
    where: { id: agentId, storeId: context.storeId, archivedAt: null },
    data: { isActive },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Agent not found.');

  if (!isActive) await revokeAllAgentSessions(agentId);

  await recordAudit(context, {
    action: 'AGENT_UPDATED',
    entityType: 'agent',
    entityId: agentId,
    after: { isActive },
  });
}

/**
 * Soft delete. The agent's name stays on the orders they handled, so the
 * record is archived rather than removed.
 */
export async function archiveAgent(context: StoreContext, agentId: string): Promise<void> {
  assertPermission(context, 'callcenter.manage');

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, storeId: context.storeId, archivedAt: null },
    select: { id: true, username: true },
  });
  if (!agent) throw new AppError('NOT_FOUND', 'Agent not found.');

  await prisma.$transaction(async (tx) => {
    await tx.agent.update({
      where: { id: agentId },
      data: { archivedAt: new Date(), isActive: false },
    });
    await tx.agentAssignmentRule.deleteMany({ where: { agentId, storeId: context.storeId } });
  });

  await revokeAllAgentSessions(agentId);

  await recordAudit(context, {
    action: 'AGENT_DELETED',
    entityType: 'agent',
    entityId: agentId,
    before: { username: agent.username },
  });
}

// ---------------------------------------------------------------------------
// Assignment rules
// ---------------------------------------------------------------------------

export async function listAgentRules(context: StoreContext) {
  assertPermission(context, 'callcenter.view');

  return prisma.agentAssignmentRule.findMany({
    where: { storeId: context.storeId },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    include: {
      agent: { select: { id: true, fullName: true, isActive: true } },
      product: { select: { id: true, name: true } },
    },
  });
}

export async function createAgentRule(
  context: StoreContext,
  input: AgentRuleInput,
): Promise<{ id: string }> {
  assertPermission(context, 'callcenter.manage');

  const agent = await prisma.agent.findFirst({
    where: { id: input.agentId, storeId: context.storeId, archivedAt: null },
    select: { id: true },
  });
  if (!agent) throw new AppError('NOT_FOUND', 'Agent not found.');

  if (input.productId) {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, storeId: context.storeId },
      select: { id: true },
    });
    if (!product) throw new AppError('NOT_FOUND', 'Product not found.');
  }

  const rule = await prisma.agentAssignmentRule.create({
    data: {
      storeId: context.storeId,
      name: input.name,
      agentId: input.agentId,
      productId: input.productId || null,
      priority: input.priority,
      isActive: input.isActive,
    },
    select: { id: true },
  });

  await recordAudit(context, {
    action: 'AGENT_UPDATED',
    entityType: 'agent_rule',
    entityId: rule.id,
    after: { name: input.name, agentId: input.agentId, productId: input.productId },
  });

  return rule;
}

export async function deleteAgentRule(context: StoreContext, ruleId: string): Promise<void> {
  assertPermission(context, 'callcenter.manage');

  const result = await prisma.agentAssignmentRule.deleteMany({
    where: { id: ruleId, storeId: context.storeId },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Rule not found.');
}

/**
 * Pick the agent for a new order.
 *
 * Rules are evaluated by ascending priority; the first product-specific match
 * wins, and a rule with no product acts as a catch-all. Ties break on rule id
 * so the result is deterministic rather than dependent on row order.
 *
 * Returns null when no rule matches — an unassigned order is a valid state, and
 * the merchant assigns it by hand.
 */
export async function resolveAgentForOrder(
  db: DbClient,
  storeId: string,
  productIds: readonly string[],
): Promise<string | null> {
  const rules = await db.agentAssignmentRule.findMany({
    where: { storeId, isActive: true, agent: { isActive: true, archivedAt: null } },
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    select: { id: true, agentId: true, productId: true },
  });

  if (rules.length === 0) return null;

  const wanted = new Set(productIds);

  for (const rule of rules) {
    if (rule.productId === null) return rule.agentId;
    if (wanted.has(rule.productId)) return rule.agentId;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Agent performance
// ---------------------------------------------------------------------------

export interface AgentStats {
  agentId: string;
  fullName: string;
  assigned: number;
  confirmed: number;
  cancelled: number;
  delivered: number;
  /** Confirmed ÷ assigned, or null when nothing has been assigned yet. */
  confirmationRate: number | null;
}

export async function getAgentStats(
  context: StoreContext,
  range?: { from: Date; to: Date },
): Promise<AgentStats[]> {
  assertPermission(context, 'callcenter.view');

  const agents = await prisma.agent.findMany({
    where: { storeId: context.storeId, archivedAt: null },
    select: { id: true, fullName: true },
  });

  const createdAt = range ? { gte: range.from, lte: range.to } : undefined;

  const grouped = await prisma.order.groupBy({
    by: ['assignedAgentId', 'status'],
    where: {
      storeId: context.storeId,
      assignedAgentId: { not: null },
      ...(createdAt ? { createdAt } : {}),
    },
    _count: { _all: true },
  });

  return agents.map((agent) => {
    const rows = grouped.filter((row) => row.assignedAgentId === agent.id);
    const countFor = (statuses: readonly string[]) =>
      rows
        .filter((row) => statuses.includes(row.status))
        .reduce((sum, row) => sum + row._count._all, 0);

    const assigned = rows.reduce((sum, row) => sum + row._count._all, 0);
    const confirmed = countFor([
      'CONFIRMED', 'PROCESSING', 'READY_FOR_SHIPPING', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED',
    ]);

    return {
      agentId: agent.id,
      fullName: agent.fullName,
      assigned,
      confirmed,
      cancelled: countFor(['CANCELLED']),
      delivered: countFor(['DELIVERED']),
      // Reported as null rather than 0% so an agent with no assignments is not
      // shown as failing.
      confirmationRate: assigned > 0 ? (confirmed / assigned) * 100 : null,
    };
  });
}
