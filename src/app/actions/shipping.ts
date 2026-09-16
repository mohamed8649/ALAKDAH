'use server';

import { revalidatePath } from 'next/cache';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import {
  archiveShippingMethod,
  connectProvider,
  deleteShippingRule,
  disconnectProvider,
  saveDeliverySlipConfig,
  saveShippingMethod,
  saveShippingRule,
  testProviderConnection,
} from '@/server/services/shipping-service';
import {
  deliverySlipSchema,
  shippingMethodSchema,
  shippingProviderSchema,
  shippingRuleSchema,
} from '@/validators/shipping';

import { zodFieldErrors } from './helpers';

const BASE = '/[locale]/(dashboard)/dashboard/shipping';

export async function saveShippingMethodAction(
  methodId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = shippingMethodSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid method.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const method = await saveShippingMethod(context, methodId, parsed.data);
    revalidatePath(`${BASE}/methods`, 'page');
    return ok(method);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function archiveShippingMethodAction(methodId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await archiveShippingMethod(context, methodId);
    revalidatePath(`${BASE}/methods`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function connectProviderAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = shippingProviderSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid carrier.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const provider = await connectProvider(context, parsed.data);
    revalidatePath(`${BASE}/providers`, 'page');
    return ok(provider);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function disconnectProviderAction(providerId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await disconnectProvider(context, providerId);
    revalidatePath(`${BASE}/providers`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function testProviderAction(
  providerId: string,
): Promise<ActionResult<{ ok: boolean; message: string }>> {
  try {
    const context = await requireStoreContext();
    const result = await testProviderConnection(context, providerId);
    revalidatePath(`${BASE}/providers`, 'page');
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveShippingRuleAction(
  ruleId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = shippingRuleSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid rule.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const rule = await saveShippingRule(context, ruleId, parsed.data);
    revalidatePath(`${BASE}/rules`, 'page');
    return ok(rule);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteShippingRuleAction(ruleId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await deleteShippingRule(context, ruleId);
    revalidatePath(`${BASE}/rules`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveDeliverySlipAction(input: unknown): Promise<ActionResult> {
  const parsed = deliverySlipSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid configuration.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    await saveDeliverySlipConfig(context, parsed.data);
    revalidatePath(`${BASE}/delivery-slip`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
