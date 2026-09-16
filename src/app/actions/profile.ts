'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { getSessionUser } from '@/server/auth/session';
import { changePassword, updateProfile } from '@/server/services/auth-service';
import { AppError } from '@/lib/errors';

import { zodFieldErrors } from './helpers';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'validation.required').max(120),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal('')),
  locale: z.enum(['ar', 'en']).default('ar'),
});

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid profile.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const user = await getSessionUser();
    if (!user) throw new AppError('UNAUTHENTICATED', 'Not signed in.');

    await updateProfile(user.id, {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      avatarUrl: parsed.data.avatarUrl || null,
      locale: parsed.data.locale,
    });

    revalidatePath('/[locale]/(dashboard)/dashboard/profile', 'page');
    revalidatePath('/[locale]/(dashboard)', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required').max(200),
    newPassword: z.string().min(8, 'validation.passwordTooShort').max(200),
    confirmPassword: z.string().min(1, 'validation.required').max(200),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'validation.passwordMismatch',
      });
    }
  });

/**
 * Change the signed-in user's password.
 *
 * On success every session is revoked, including this one, so the browser is
 * signed out and has to authenticate with the new password.
 */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid password.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const user = await getSessionUser();
    if (!user) throw new AppError('UNAUTHENTICATED', 'Not signed in.');

    await changePassword(user.id, {
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });

    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
