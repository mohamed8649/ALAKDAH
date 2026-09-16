'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { removePixel, savePixel } from '@/server/services/pixel-service';

import { zodFieldErrors } from './helpers';

const pixelSchema = z.object({
  providerKey: z.string().trim().min(1).max(60),
  pixelId: z.string().trim().max(120).default(''),
  isActive: z.boolean().default(false),
  eventMapping: z.record(z.string().max(80)).default({}),
  /** Write-only; blank means "keep the stored token". */
  serverToken: z.string().trim().max(500).optional(),
});

export async function savePixelAction(input: unknown): Promise<ActionResult> {
  const parsed = pixelSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    await savePixel(context, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/pixels', 'page');
    revalidatePath('/[locale]/(storefront)/[storeSlug]', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function removePixelAction(providerKey: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await removePixel(context, providerKey);
    revalidatePath('/[locale]/(dashboard)/dashboard/pixels', 'page');
    revalidatePath('/[locale]/(storefront)/[storeSlug]', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
