'use server';

import { revalidatePath } from 'next/cache';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import {
  createAccessToken,
  revokeAccessToken,
  type CreatedToken,
} from '@/server/services/token-service';
import { accessTokenSchema } from '@/validators/store';

import { zodFieldErrors } from './helpers';

const TOKENS_PATH = '/[locale]/(dashboard)/dashboard/settings/tokens';

export async function createTokenAction(input: unknown): Promise<ActionResult<CreatedToken>> {
  const parsed = accessTokenSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid token.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const token = await createAccessToken(context, parsed.data);
    revalidatePath(TOKENS_PATH, 'page');
    return ok(token);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function revokeTokenAction(tokenId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await revokeAccessToken(context, tokenId);
    revalidatePath(TOKENS_PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
