import { applyPercent } from '@/lib/money';

/**
 * Campaign and product-offer pricing.
 *
 * Every price a customer is charged is computed here, on the server, from
 * stored data. The browser clock is never consulted: a device with the wrong
 * date must not unlock an expired discount.
 */

export interface CampaignInput {
  id: string;
  name: string;
  discountPercent: number;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  appliesToAll: boolean;
  productIds: readonly string[];
}

export type CampaignState = 'scheduled' | 'running' | 'ended' | 'paused';

export function campaignState(campaign: CampaignInput, now: Date): CampaignState {
  if (!campaign.isActive) return 'paused';
  if (now < campaign.startAt) return 'scheduled';
  if (now > campaign.endAt) return 'ended';
  return 'running';
}

export function isCampaignRunning(campaign: CampaignInput, now: Date): boolean {
  return campaignState(campaign, now) === 'running';
}

export function campaignApplies(campaign: CampaignInput, productId: string, now: Date): boolean {
  if (!isCampaignRunning(campaign, now)) return false;
  return campaign.appliesToAll || campaign.productIds.includes(productId);
}

export interface EffectivePrice {
  /** What the customer pays per unit, in minor units. */
  price: number;
  /** The struck-through price, or null when there is nothing to strike. */
  compareAt: number | null;
  discountPercent: number;
  campaignId: string | null;
  campaignName: string | null;
}

/**
 * Resolve the price a customer sees for one unit.
 *
 * When several campaigns cover the same product the deepest discount wins —
 * the merchant advertised it, so the customer gets it.
 */
export function effectivePrice(
  product: { id: string; price: number; compareAtPrice: number | null },
  campaigns: readonly CampaignInput[],
  now: Date,
): EffectivePrice {
  const applicable = campaigns.filter((campaign) => campaignApplies(campaign, product.id, now));

  if (applicable.length === 0) {
    return {
      price: product.price,
      compareAt: product.compareAtPrice,
      discountPercent: discountBetween(product.compareAtPrice, product.price),
      campaignId: null,
      campaignName: null,
    };
  }

  const best = applicable.reduce((deepest, candidate) =>
    candidate.discountPercent > deepest.discountPercent ? candidate : deepest,
  );

  const discounted = applyPercent(product.price, best.discountPercent);

  return {
    price: discounted,
    compareAt: product.price,
    discountPercent: best.discountPercent,
    campaignId: best.id,
    campaignName: best.name,
  };
}

/** Percentage saved, rounded to a whole number for badge display. */
export function discountBetween(compareAt: number | null, price: number): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

// ---------------------------------------------------------------------------
// Product-level offers
// ---------------------------------------------------------------------------

export interface OfferInput {
  id: string;
  type: 'QUANTITY_DISCOUNT' | 'BUNDLE_PRICE' | 'FREE_SHIPPING';
  title: string;
  minQuantity: number;
  discountPercent: number | null;
  fixedPrice: number | null;
  isActive: boolean;
}

export interface OfferResult {
  lineTotal: number;
  appliedOffer: OfferInput | null;
  freeShipping: boolean;
}

/**
 * Apply the best product-level offer to one cart line.
 *
 * Product offers are line-level and separate from campaigns, which are
 * store-level. `unitPrice` is the campaign-adjusted price, so the two stack in
 * a defined order: campaign first, then the quantity offer on the result.
 */
export function applyOffers(
  unitPrice: number,
  quantity: number,
  offers: readonly OfferInput[],
): OfferResult {
  const base = unitPrice * quantity;

  const eligible = offers.filter(
    (offer) => offer.isActive && quantity >= offer.minQuantity,
  );

  if (eligible.length === 0) {
    return { lineTotal: base, appliedOffer: null, freeShipping: false };
  }

  let bestTotal = base;
  let bestOffer: OfferInput | null = null;
  let freeShipping = false;

  for (const offer of eligible) {
    if (offer.type === 'FREE_SHIPPING') {
      freeShipping = true;
      continue;
    }

    const candidate =
      offer.type === 'BUNDLE_PRICE' && offer.fixedPrice !== null
        ? offer.fixedPrice * Math.floor(quantity / offer.minQuantity) +
          unitPrice * (quantity % offer.minQuantity)
        : offer.discountPercent !== null
          ? applyPercent(base, offer.discountPercent)
          : base;

    if (candidate < bestTotal) {
      bestTotal = candidate;
      bestOffer = offer;
    }
  }

  return { lineTotal: bestTotal, appliedOffer: bestOffer, freeShipping };
}
