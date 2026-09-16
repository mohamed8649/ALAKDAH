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
 *
 * The post-login navigation happens here, on the server, rather than as a
 * `router.replace` in the form. A client-side navigation issued in the same
 * tick as a server action's response is not reliable — it was silently
 * swallowed in roughly a third of sign-ins, leaving the merchant on the login
 * page holding a valid session with nothing on screen to explain it. A server
 * redirect is part of the action's own response and cannot be raced.
 *
 * `redirect()` works by throwing, so it is called outside the try block; a
 * catch would otherwise treat the navigation as a failure.
 */

export async function loginAction(
  input: unknown,
  locale: string,
): Promise<ActionResult<never>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    await login(parsed.data);
  } catch (error) {
    return toActionResult(error);
  }

  redirect(`/${safeLocale(locale)}/dashboard`);
}

export async function registerAction(
  input: unknown,
  locale: string,
): Promise<ActionResult<never>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    await register(parsed.data);
  } catch (error) {
    return toActionResult(error);
  }

  redirect(`/${safeLocale(locale)}/dashboard`);
}

export async function agentLoginAction(
  input: unknown,
  locale: string,
): Promise<ActionResult<never>> {
  const parsed = agentLoginSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    await agentLogin(parsed.data);
  } catch (error) {
    return toActionResult(error);
  }

  redirect(`/${safeLocale(locale)}/agent/orders`);
}

export async function redirectTo(path: string): Promise<never> {
  redirect(path);
}

/** The locale is a path segment, so it is constrained rather than trusted. */
function safeLocale(locale: string): string {
  return locale === 'en' ? 'en' : 'ar';
}
