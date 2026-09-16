'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { changePlan } from '@/server/services/billing-service';

const schema = z.object({
  planKey: z.string().min(1),
  interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});

export async function changePlanAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION_FAILED', 'Invalid plan.');

  try {
    const context = await requireStoreContext();
    await changePlan(context, parsed.data.planKey, parsed.data.interval);
    revalidatePath('/[locale]/(dashboard)/dashboard/billing', 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
