'use server';

import { revalidatePath } from 'next/cache';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { activateTheme, installTheme, updateDesign } from '@/server/services/theme-service';
import { designSchema } from '@/validators/store';

import { zodFieldErrors } from './helpers';

export async function installThemeAction(themeKey: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await installTheme(context, themeKey);
    revalidatePath('/[locale]/(dashboard)/dashboard/themes', 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function activateThemeAction(themeKey: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await activateTheme(context, themeKey);
    revalidatePath('/[locale]/(dashboard)/dashboard/themes', 'page');
    revalidatePath('/[locale]/(storefront)/[storeSlug]', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateDesignAction(input: unknown): Promise<ActionResult> {
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid design.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    await updateDesign(context, {
      primaryColor: parsed.data.primaryColor,
      secondaryColor: parsed.data.secondaryColor,
      fontFamily: parsed.data.fontFamily,
      logoUrl: parsed.data.logoUrl || null,
      faviconUrl: parsed.data.faviconUrl || null,
      announcementEnabled: parsed.data.announcementEnabled,
      announcementText: parsed.data.announcementText || null,
    });
    revalidatePath('/[locale]/(dashboard)/dashboard/design', 'page');
    revalidatePath('/[locale]/(storefront)/[storeSlug]', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
