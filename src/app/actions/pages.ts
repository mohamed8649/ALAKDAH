'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { archivePage, savePage, setPageStatus } from '@/server/services/page-service';

import { zodFieldErrors } from './helpers';

const PATH = '/[locale]/(dashboard)/dashboard/pages';

const pageSchema = z.object({
  title: z.string().trim().min(2, 'validation.required').max(200),
  slug: z.string().trim().max(80).optional(),
  productId: z.string().nullable().optional(),
  // The document is validated structurally by the service, which strips any
  // block type or prop it does not recognise. `z.unknown()` alone would make
  // the key optional, so it is explicitly defaulted.
  document: z.unknown().default({ version: 1, blocks: [] }),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(400).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED']).optional(),
  generatedByAi: z.boolean().optional(),
  aiPreset: z.string().max(60).nullable().optional(),
});

export async function savePageAction(
  pageId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid page.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const page = await savePage(context, pageId, parsed.data);
    revalidatePath(PATH, 'page');
    if (pageId) revalidatePath(`${PATH}/${pageId}`, 'page');
    return ok(page);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setPageStatusAction(
  pageId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED',
): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await setPageStatus(context, pageId, status);
    revalidatePath(PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function archivePageAction(pageId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await archivePage(context, pageId);
    revalidatePath(PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
