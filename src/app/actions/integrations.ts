'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { IMPORT_TARGETS } from '@/server/catalog/integrations';
import { requireStoreContext } from '@/server/policies/context';
import {
  buildImportPreview,
  connectIntegration,
  disconnectIntegration,
  startImport,
  testIntegration,
  type ImportPreview,
} from '@/server/services/integration-service';

import { zodFieldErrors } from './helpers';

const connectSchema = z.object({
  providerKey: z.string().trim().min(1).max(60),
  credentials: z.record(z.string().max(4000)).default({}),
  fieldMapping: z.record(z.string().max(60)).optional(),
});

export async function connectIntegrationAction(input: unknown): Promise<ActionResult> {
  const parsed = connectSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    await connectIntegration(context, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/integrations', 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function disconnectIntegrationAction(providerKey: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await disconnectIntegration(context, providerKey);
    revalidatePath('/[locale]/(dashboard)/dashboard/integrations', 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function testIntegrationAction(
  providerKey: string,
): Promise<ActionResult<{ ok: boolean; message: string }>> {
  try {
    const context = await requireStoreContext();
    const result = await testIntegration(context, providerKey);
    revalidatePath('/[locale]/(dashboard)/dashboard/integrations', 'page');
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}

const previewSchema = z.object({
  // The file's text, read in the browser. Bounded so a 40MB paste cannot be
  // pushed through a server action.
  text: z.string().min(1).max(4_000_000),
  target: z.enum(IMPORT_TARGETS),
});

export async function previewImportAction(input: unknown): Promise<ActionResult<ImportPreview>> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    // Permission is checked here because parsing alone reveals nothing, but
    // the endpoint still belongs to a merchant session.
    await requireStoreContext();
    return ok(buildImportPreview(parsed.data.text, parsed.data.target));
  } catch (error) {
    return toActionResult(error);
  }
}

const startImportSchema = z.object({
  source: z.string().trim().min(1).max(60),
  target: z.enum(IMPORT_TARGETS),
  mapping: z.record(z.string().max(60)),
  rows: z.array(z.record(z.string().max(4000))).min(1).max(2000),
});

export async function startImportAction(
  input: unknown,
): Promise<ActionResult<{ jobId: string }>> {
  const parsed = startImportSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const result = await startImport(context, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/integrations', 'page');
    revalidatePath('/[locale]/(dashboard)/dashboard/products', 'page');
    revalidatePath('/[locale]/(dashboard)/dashboard/orders', 'page');
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}
