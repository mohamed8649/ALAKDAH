'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { archiveCampaign, saveCampaign } from '@/server/services/campaign-service';

import { zodFieldErrors } from './helpers';

const PATH = '/[locale]/(dashboard)/dashboard/campaigns';

const campaignSchema = z.object({
  name: z.string().trim().min(2, 'validation.required').max(120),
  discountPercent: z.coerce.number().int().min(1).max(90),
  startAt: z.string().min(1, 'validation.required'),
  endAt: z.string().min(1, 'validation.required'),
  isActive: z.boolean().default(true),
  appliesToAll: z.boolean().default(false),
  productIds: z.array(z.string()).max(500).default([]),
});

export async function saveCampaignAction(
  campaignId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid campaign.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    const campaign = await saveCampaign(context, campaignId, parsed.data);
    revalidatePath(PATH, 'page');
    return ok(campaign);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function archiveCampaignAction(campaignId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await archiveCampaign(context, campaignId);
    revalidatePath(PATH, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
