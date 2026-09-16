'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { addStaffMember, changeStaffRole, removeStaffMember } from '@/server/services/staff-service';

import { zodFieldErrors } from './helpers';

const PATH = '/[locale]/(dashboard)/dashboard/staff';

const addSchema = z.object({
  email: z.string().trim().email('validation.invalidEmail').max(200),
  roleKey: z.string().min(1, 'validation.required'),
});

export async function addStaffAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const member = await addStaffMember(context, parsed.data);
    revalidatePath(PATH, 'page');
    return ok(member);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function changeStaffRoleAction(
  memberId: string,
  roleKey: string,
): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await changeStaffRole(context, memberId, roleKey);
    revalidatePath(PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function removeStaffAction(memberId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await removeStaffMember(context, memberId);
    revalidatePath(PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
