'use server';

import { revalidatePath } from 'next/cache';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import {
  blockIp,
  deleteCustomField,
  saveCustomField,
  saveTrustBadges,
  setAppEnabled,
  unblockIp,
  updateCheckoutFields,
  updateCheckoutSettings,
  updateStoreIdentity,
  updateStoreNotifications,
  updateStoreSecurity,
} from '@/server/services/store-service';
import {
  checkoutFieldsSchema,
  checkoutSettingsSchema,
  customFieldSchema,
  storeIdentitySchema,
  storeNotificationSchema,
  storeSecuritySchema,
} from '@/validators/store';

import { zodFieldErrors } from './helpers';

const SETTINGS = '/[locale]/(dashboard)/dashboard/settings';

export async function updateIdentityAction(input: unknown): Promise<ActionResult> {
  const parsed = storeIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid settings.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    await updateStoreIdentity(context, parsed.data);
    revalidatePath('/', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateCheckoutFieldsAction(input: unknown): Promise<ActionResult> {
  const parsed = checkoutFieldsSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION_FAILED', 'Invalid fields.');

  try {
    const context = await requireStoreContext();
    await updateCheckoutFields(context, parsed.data);
    revalidatePath(`${SETTINGS}/checkout`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateCheckoutSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = checkoutSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid settings.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    await updateCheckoutSettings(context, {
      ...parsed.data,
      thankYouButtonUrl: parsed.data.thankYouButtonUrl || null,
      quickContactPhone: parsed.data.quickContactPhone || null,
      quickContactWhatsapp: parsed.data.quickContactWhatsapp || null,
    });
    revalidatePath(`${SETTINGS}/checkout`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateSecurityAction(input: unknown): Promise<ActionResult> {
  const parsed = storeSecuritySchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid settings.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    await updateStoreSecurity(context, parsed.data);
    revalidatePath(`${SETTINGS}/security`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateNotificationsAction(input: unknown): Promise<ActionResult> {
  const parsed = storeNotificationSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION_FAILED', 'Invalid settings.');

  try {
    const context = await requireStoreContext();
    await updateStoreNotifications(context, parsed.data);
    revalidatePath(`${SETTINGS}/notifications`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveCustomFieldAction(
  fieldId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = customFieldSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid field.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireStoreContext();
    const field = await saveCustomField(context, fieldId, parsed.data);
    revalidatePath(`${SETTINGS}/checkout`, 'page');
    return ok(field);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteCustomFieldAction(fieldId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await deleteCustomField(context, fieldId);
    revalidatePath(`${SETTINGS}/checkout`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveTrustBadgesAction(
  badges: Array<{ title: string; description: string | null; icon: string; isActive: boolean }>,
): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await saveTrustBadges(context, badges);
    revalidatePath('/[locale]/(dashboard)/dashboard/apps/trust-badges', 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function blockIpAction(ip: string, reason: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await blockIp(context, ip.trim(), reason.trim() || null);
    revalidatePath(`${SETTINGS}/security`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function unblockIpAction(id: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await unblockIp(context, id);
    revalidatePath(`${SETTINGS}/security`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setAppEnabledAction(
  appKey: string,
  isEnabled: boolean,
): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await setAppEnabled(context, appKey, isEnabled);
    revalidatePath('/[locale]/(dashboard)/dashboard/apps', 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
