'use server';

import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import {
  adoptLogoCandidate,
  COPY_FRAMEWORKS,
  generateLandingPage,
  generateLogoCandidates,
  generateProductDescription,
  STYLE_PRESETS,
  type GeneratedPageDraft,
  type GenerationDraft,
  type LogoCandidate,
} from '@/server/services/ai-service';

import { zodFieldErrors } from './helpers';

const descriptionSchema = z.object({
  productName: z.string().trim().min(2).max(200),
  category: z.string().trim().max(120).nullable().optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(15).default([]),
  tone: z.enum(['professional', 'friendly', 'luxury', 'energetic', 'simple']).default('professional'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  language: z.enum(['ar', 'en']).default('ar'),
  instructions: z.string().trim().max(600).nullable().optional(),
});

export async function generateDescriptionAction(
  input: unknown,
): Promise<ActionResult<GenerationDraft>> {
  const parsed = descriptionSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    return ok(await generateProductDescription(context, parsed.data));
  } catch (error) {
    return toActionResult(error);
  }
}

const landingPageSchema = z.object({
  productId: z.string().min(1),
  language: z.enum(['ar', 'en']).default('ar'),
  framework: z.enum(COPY_FRAMEWORKS).default('AIDA'),
  preset: z.enum(STYLE_PRESETS).default('clean_aqua'),
  tone: z.enum(['professional', 'friendly', 'luxury', 'energetic', 'simple']).default('professional'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  instructions: z.string().trim().max(600).nullable().optional(),
});

export async function generateLandingPageAction(
  input: unknown,
): Promise<ActionResult<GeneratedPageDraft>> {
  const parsed = landingPageSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    return ok(await generateLandingPage(context, parsed.data));
  } catch (error) {
    return toActionResult(error);
  }
}

export async function generateLogoAction(
  storeName: string,
): Promise<ActionResult<LogoCandidate[]>> {
  try {
    const context = await requireStoreContext();
    return ok(await generateLogoCandidates(context, { storeName }));
  } catch (error) {
    return toActionResult(error);
  }
}

const adoptLogoSchema = z.object({
  storeName: z.string().trim().min(1).max(120),
  candidateId: z.string().trim().regex(/^logo_\d+$/),
});

/**
 * Turn a chosen candidate into a stored file and hand back its URL.
 *
 * The design form still has to be saved afterwards, so choosing a candidate
 * never changes the live storefront by itself.
 */
export async function adoptLogoAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = adoptLogoSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    return ok(await adoptLogoCandidate(context, parsed.data));
  } catch (error) {
    return toActionResult(error);
  }
}
