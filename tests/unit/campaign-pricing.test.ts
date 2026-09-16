import { describe, expect, it } from 'vitest';

import {
  applyOffers,
  campaignApplies,
  campaignState,
  discountBetween,
  effectivePrice,
  type CampaignInput,
  type OfferInput,
} from '@/features/campaigns/pricing';

const campaign = (overrides: Partial<CampaignInput> & { id: string }): CampaignInput => ({
  name: overrides.id,
  discountPercent: 10,
  startAt: new Date('2026-01-01T00:00:00Z'),
  endAt: new Date('2026-12-31T23:59:59Z'),
  isActive: true,
  appliesToAll: true,
  productIds: [],
  ...overrides,
});

const NOW = new Date('2026-06-01T12:00:00Z');
const product = { id: 'p1', price: 100_000, compareAtPrice: null };

/**
 * Pricing is computed on the server from stored dates. The tests pass an
 * explicit `now` for the same reason the implementation takes one: a customer's
 * device clock must never be able to unlock an expired campaign.
 */
describe('campaignState', () => {
  it('classifies a campaign by its window', () => {
    expect(campaignState(campaign({ id: 'c' }), NOW)).toBe('running');
    expect(
      campaignState(campaign({ id: 'c', startAt: new Date('2026-07-01T00:00:00Z') }), NOW),
    ).toBe('scheduled');
    expect(campaignState(campaign({ id: 'c', endAt: new Date('2026-02-01T00:00:00Z') }), NOW)).toBe(
      'ended',
    );
  });

  it('reports a deactivated campaign as paused, not running', () => {
    expect(campaignState(campaign({ id: 'c', isActive: false }), NOW)).toBe('paused');
  });
});

describe('campaignApplies', () => {
  it('covers every product when appliesToAll is set', () => {
    expect(campaignApplies(campaign({ id: 'c' }), 'anything', NOW)).toBe(true);
  });

  it('otherwise covers only the listed products', () => {
    const scoped = campaign({ id: 'c', appliesToAll: false, productIds: ['p1'] });
    expect(campaignApplies(scoped, 'p1', NOW)).toBe(true);
    expect(campaignApplies(scoped, 'p2', NOW)).toBe(false);
  });

  it('never applies outside the window', () => {
    const expired = campaign({ id: 'c', endAt: new Date('2026-02-01T00:00:00Z') });
    expect(campaignApplies(expired, 'p1', NOW)).toBe(false);
  });
});

describe('effectivePrice', () => {
  it('leaves the price alone when no campaign applies', () => {
    const result = effectivePrice(product, [], NOW);
    expect(result.price).toBe(100_000);
    expect(result.campaignId).toBeNull();
  });

  it('applies the discount and strikes the original price', () => {
    const result = effectivePrice(product, [campaign({ id: 'c', discountPercent: 25 })], NOW);
    expect(result.price).toBe(75_000);
    expect(result.compareAt).toBe(100_000);
    expect(result.discountPercent).toBe(25);
    expect(result.campaignId).toBe('c');
  });

  it('gives the customer the deepest of several overlapping campaigns', () => {
    const result = effectivePrice(
      product,
      [
        campaign({ id: 'small', discountPercent: 10 }),
        campaign({ id: 'big', discountPercent: 40 }),
        campaign({ id: 'expired', discountPercent: 90, endAt: new Date('2026-01-02T00:00:00Z') }),
      ],
      NOW,
    );

    expect(result.campaignId).toBe('big');
    expect(result.price).toBe(60_000);
  });

  it('always returns an integer number of minor units', () => {
    for (const percent of [3, 7, 13, 17, 33, 66]) {
      const result = effectivePrice(product, [campaign({ id: 'c', discountPercent: percent })], NOW);
      expect(Number.isInteger(result.price)).toBe(true);
    }
  });
});

describe('discountBetween', () => {
  it('reports the saving as a whole percent', () => {
    expect(discountBetween(100_000, 75_000)).toBe(25);
  });

  it('reports nothing when there is nothing to strike', () => {
    expect(discountBetween(null, 75_000)).toBe(0);
    expect(discountBetween(50_000, 75_000)).toBe(0);
  });
});

const offer = (overrides: Partial<OfferInput> & { id: string }): OfferInput => ({
  type: 'QUANTITY_DISCOUNT',
  title: overrides.id,
  minQuantity: 2,
  discountPercent: null,
  fixedPrice: null,
  isActive: true,
  ...overrides,
});

describe('applyOffers', () => {
  it('charges the plain total when no offer qualifies', () => {
    const result = applyOffers(50_000, 1, [offer({ id: 'o', discountPercent: 20 })]);
    expect(result.lineTotal).toBe(50_000);
    expect(result.appliedOffer).toBeNull();
  });

  it('applies a quantity discount once the threshold is reached', () => {
    const result = applyOffers(50_000, 2, [offer({ id: 'o', discountPercent: 20 })]);
    expect(result.lineTotal).toBe(80_000);
    expect(result.appliedOffer?.id).toBe('o');
  });

  it('prices a bundle by the pack and charges the remainder normally', () => {
    // Three units with a 2-for-90.000 bundle: one pack plus one loose unit.
    const result = applyOffers(50_000, 3, [
      offer({ id: 'bundle', type: 'BUNDLE_PRICE', minQuantity: 2, fixedPrice: 90_000 }),
    ]);
    expect(result.lineTotal).toBe(140_000);
  });

  it('picks the cheapest offer for the customer', () => {
    const result = applyOffers(50_000, 4, [
      offer({ id: 'ten', discountPercent: 10 }),
      offer({ id: 'thirty', discountPercent: 30 }),
    ]);
    expect(result.appliedOffer?.id).toBe('thirty');
    expect(result.lineTotal).toBe(140_000);
  });

  it('never makes a line more expensive than the plain total', () => {
    const result = applyOffers(50_000, 2, [
      offer({ id: 'bad', type: 'BUNDLE_PRICE', minQuantity: 2, fixedPrice: 999_000 }),
    ]);
    expect(result.lineTotal).toBe(100_000);
    expect(result.appliedOffer).toBeNull();
  });

  it('reports free shipping separately from the line total', () => {
    const result = applyOffers(50_000, 2, [offer({ id: 'ship', type: 'FREE_SHIPPING' })]);
    expect(result.freeShipping).toBe(true);
    expect(result.lineTotal).toBe(100_000);
  });

  it('ignores inactive offers', () => {
    const result = applyOffers(50_000, 2, [
      offer({ id: 'off', discountPercent: 50, isActive: false }),
    ]);
    expect(result.lineTotal).toBe(100_000);
  });
});
