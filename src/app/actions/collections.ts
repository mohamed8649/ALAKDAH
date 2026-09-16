'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { deleteCollection, saveCollection } from '@/server/services/collection-service';

import { zodFieldErrors } from './helpers';

const collectionSchema = z.object({
  title: z.string().trim().min(2, 'validation.required').max(120),
  handle: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(600).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
  productIds: z.array(z.string().min(1)).max(500).default([]),
});

export async function saveCollectionAction(
  collectionId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string; handle: string }>> {
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid collection.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    const result = await saveCollection(context, collectionId, {
      title: parsed.data.title,
      handle: parsed.data.handle || undefined,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      isActive: parsed.data.isActive,
      productIds: parsed.data.productIds,
    });

    revalidatePath('/[locale]/(dashboard)/dashboard/collections', 'page');
    revalidatePath('/[locale]/(storefront)/[storeSlug]', 'layout');
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteCollectionAction(collectionId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await deleteCollection(context, collectionId);
    revalidatePath('/[locale]/(dashboard)/dashboard/collections', 'page');
    revalidatePath('/[locale]/(storefront)/[storeSlug]', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
