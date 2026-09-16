'use server';

import { revalidatePath } from 'next/cache';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import {
  archiveAgent,
  createAgent,
  createAgentRule,
  deleteAgentRule,
  setAgentActive,
  updateAgent,
} from '@/server/services/agent-service';
import { agentRuleSchema, agentSchema } from '@/validators/agent';

import { zodFieldErrors } from './helpers';

const AGENTS_PATH = '/[locale]/(dashboard)/dashboard/call-center/agents';
const RULES_PATH = '/[locale]/(dashboard)/dashboard/call-center/rules';

export async function createAgentAction(
  input: unknown,
): Promise<ActionResult<{ id: string; username: string }>> {
  const parsed = agentSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid agent.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const agent = await createAgent(context, parsed.data);
    revalidatePath(AGENTS_PATH, 'page');
    return ok(agent);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateAgentAction(agentId: string, input: unknown): Promise<ActionResult> {
  const parsed = agentSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid agent.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    await updateAgent(context, agentId, parsed.data);
    revalidatePath(AGENTS_PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setAgentActiveAction(
  agentId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await setAgentActive(context, agentId, isActive);
    revalidatePath(AGENTS_PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function archiveAgentAction(agentId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await archiveAgent(context, agentId);
    revalidatePath(AGENTS_PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createAgentRuleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = agentRuleSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid rule.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const rule = await createAgentRule(context, parsed.data);
    revalidatePath(RULES_PATH, 'page');
    return ok(rule);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteAgentRuleAction(ruleId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await deleteAgentRule(context, ruleId);
    revalidatePath(RULES_PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
