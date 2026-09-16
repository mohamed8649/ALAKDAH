'use server';

import { revalidatePath } from 'next/cache';

import { ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { dismissAbandoned } from '@/server/services/checkout-service';

export async function dismissAbandonedAction(id: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await dismissAbandoned(context, id);
    revalidatePath('/[locale]/(dashboard)/dashboard/abandoned', 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
