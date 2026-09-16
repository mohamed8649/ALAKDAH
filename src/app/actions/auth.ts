'use server';

import { redirect } from 'next/navigation';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { agentLogin, login, register } from '@/server/services/auth-service';
import { agentLoginSchema } from '@/validators/agent';
import { loginSchema, registerSchema } from '@/validators/auth';

import { zodFieldErrors } from './helpers';

/**
 * Authentication actions.
 *
 * Every action re-validates its input on the server. The browser's copy of the
 * same Zod schema is a convenience for the merchant, not a control.
 */

export async function loginAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    await login(parsed.data);
    return ok({ redirectTo: '/dashboard' });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function registerAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    await register(parsed.data);
    return ok({ redirectTo: '/dashboard' });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function agentLoginAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = agentLoginSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    await agentLogin(parsed.data);
    return ok({ redirectTo: '/agent/orders' });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function redirectTo(path: string): Promise<never> {
  redirect(path);
}
