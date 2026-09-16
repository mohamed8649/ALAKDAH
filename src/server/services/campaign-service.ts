import 'server-only';

import { prisma } from '@/db/client';
import { campaignState, type CampaignInput } from '@/features/campaigns/pricing';
import { AppError } from '@/lib/errors';
import { assertPermission, type StoreContext } from '@/server/policies/context';

import { recordAudit } from './audit-service';

/**
 * Campaigns.
 *
 * Dates are stored as UTC instants and evaluated on the server. A campaign's
 * live/scheduled/ended state is never computed from the browser clock — a
 * device with the wrong date must not unlock an expired discount.
 */

export interface CampaignRow {
  id: string;
  name: string;
  discountPercent: number;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  appliesToAll: boolean;
  productIds: string[];
  productCount: number;
  state: string;
}

export async function listCampaigns(context: StoreContext): Promise<CampaignRow[]> {
  assertPermission(context, 'campaigns.view');

  const rows = await prisma.campaign.findMany({
    where: { storeId: context.storeId, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { products: { select: { productId: true } } },
  });

  const now = new Date();

  return rows.map((row) => {
    const input: CampaignInput = {
      id: row.id,
      name: row.name,
      discountPercent: row.discountPercent,
      startAt: row.startAt,
      endAt: row.endAt,
      isActive: row.isActive,
      appliesToAll: row.appliesToAll,
      productIds: row.products.map((link) => link.productId),
    };

    return {
      ...input,
      productIds: [...input.productIds],
      productCount: input.productIds.length,
      state: campaignState(input, now),
    };
  });
}

export interface CampaignSaveInput {
  name: string;
  discountPercent: number;
  startAt: string;
  endAt: string;
  isActive: boolean;
  appliesToAll: boolean;
  productIds: string[];
}

export async function saveCampaign(
  context: StoreContext,
  campaignId: string | null,
  input: CampaignSaveInput,
): Promise<{ id: string }> {
  assertPermission(context, 'campaigns.manage');

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new AppError('VALIDATION_FAILED', 'Invalid dates.', {
      fieldErrors: { startAt: ['validation.invalidNumber'] },
    });
  }
  if (endAt <= startAt) {
    throw new AppError('VALIDATION_FAILED', 'End before start.', {
      fieldErrors: { endAt: ['validation.endBeforeStart'] },
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const data = {
      name: input.name,
      discountPercent: input.discountPercent,
      startAt,
      endAt,
      isActive: input.isActive,
      appliesToAll: input.appliesToAll,
    };

    let campaign: { id: string };

    if (campaignId) {
      const existing = await tx.campaign.findFirst({
        where: { id: campaignId, storeId: context.storeId },
        select: { id: true },
      });
      if (!existing) throw new AppError('NOT_FOUND', 'Campaign not found.');

      campaign = await tx.campaign.update({
        where: { id: campaignId },
        data,
        select: { id: true },
      });
      await tx.campaignProduct.deleteMany({ where: { campaignId } });
    } else {
      campaign = await tx.campaign.create({
        data: { ...data, storeId: context.storeId },
        select: { id: true },
      });
    }

    if (!input.appliesToAll && input.productIds.length > 0) {
      // Product ids are re-checked against the tenant; an id in the request
      // body proves nothing about who owns it.
      const owned = await tx.product.findMany({
        where: { storeId: context.storeId, id: { in: input.productIds } },
        select: { id: true },
      });

      if (owned.length > 0) {
        await tx.campaignProduct.createMany({
          data: owned.map((product) => ({ campaignId: campaign.id, productId: product.id })),
          skipDuplicates: true,
        });
      }
    }

    return campaign;
  });

  await recordAudit(context, {
    action: 'CAMPAIGN_CREATED',
    entityType: 'campaign',
    entityId: result.id,
    after: {
      name: input.name,
      discountPercent: input.discountPercent,
      appliesToAll: input.appliesToAll,
    },
  });

  return result;
}

export async function archiveCampaign(context: StoreContext, campaignId: string): Promise<void> {
  assertPermission(context, 'campaigns.manage');

  const result = await prisma.campaign.updateMany({
    where: { id: campaignId, storeId: context.storeId },
    data: { archivedAt: new Date(), isActive: false },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Campaign not found.');
}
