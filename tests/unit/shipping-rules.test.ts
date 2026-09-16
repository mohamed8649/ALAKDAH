import { describe, expect, it } from 'vitest';

import {
  matchShippingRule,
  resolveShippingPrice,
  ruleMatches,
  type MethodInput,
  type RuleInput,
  type ZoneInput,
} from '@/features/shipping/rules';

const zone = (overrides: Partial<ZoneInput> & { id: string }): ZoneInput => ({
  name: overrides.id,
  price: 0,
  regions: [],
  cities: [],
  position: 0,
  ...overrides,
});

const method = (zones: ZoneInput[], base = 30_000): MethodInput => ({
  id: 'method',
  price: base,
  zones,
});

/**
 * Shipping price and carrier routing are where a merchant's margin lives. The
 * rule that matters is specificity: the most precise zone wins, regardless of
 * the order the zones happen to come back from the database in.
 */
describe('resolveShippingPrice', () => {
  const zones = [
    zone({ id: 'city', cities: ['بنغازي'], price: 15_000, position: 5 }),
    zone({ id: 'region', regions: ['بنغازي'], price: 20_000, position: 3 }),
    zone({ id: 'catchall', price: 25_000, position: 1 }),
  ];

  it('prefers a city zone over a region zone', () => {
    const result = resolveShippingPrice(method(zones), { state: 'بنغازي', city: 'بنغازي' });
    expect(result.zoneId).toBe('city');
    expect(result.price).toBe(15_000);
  });

  it('falls back to the region zone when the city does not match', () => {
    const result = resolveShippingPrice(method(zones), { state: 'بنغازي', city: 'قمينس' });
    expect(result.zoneId).toBe('region');
    expect(result.price).toBe(20_000);
  });

  it('falls back to a catch-all zone before the base price', () => {
    const result = resolveShippingPrice(method(zones), { state: 'سبها', city: 'سبها' });
    expect(result.zoneId).toBe('catchall');
    expect(result.usedBasePrice).toBe(false);
  });

  it('uses the base price when nothing matches at all', () => {
    const onlyCity = [zone({ id: 'tripoli', cities: ['طرابلس'], price: 10_000 })];
    const result = resolveShippingPrice(method(onlyCity), { state: 'سبها', city: 'سبها' });

    expect(result.usedBasePrice).toBe(true);
    expect(result.price).toBe(30_000);
    expect(result.zoneId).toBeNull();
  });

  it('breaks a tie on position, not on array order', () => {
    const tied = [
      zone({ id: 'late', cities: ['طرابلس'], price: 9_000, position: 9 }),
      zone({ id: 'early', cities: ['طرابلس'], price: 8_000, position: 1 }),
    ];
    const result = resolveShippingPrice(method(tied), { state: '', city: 'طرابلس' });
    expect(result.zoneId).toBe('early');
  });

  it('ignores surrounding whitespace and case in names', () => {
    const named = [zone({ id: 'z', cities: ['Tripoli'], price: 5_000 })];
    const result = resolveShippingPrice(method(named), { state: '', city: '  tripoli  ' });
    expect(result.zoneId).toBe('z');
  });

  it('does not treat an empty destination as a city match', () => {
    const named = [zone({ id: 'z', cities: ['طرابلس'], price: 5_000 })];
    const result = resolveShippingPrice(method(named), { state: '', city: '' });
    expect(result.usedBasePrice).toBe(true);
  });
});

const rule = (overrides: Partial<RuleInput> & { id: string }): RuleInput => ({
  name: overrides.id,
  priority: 1,
  isActive: true,
  matchState: null,
  matchCity: null,
  matchMinTotal: null,
  matchMaxTotal: null,
  matchMethodType: null,
  providerId: `provider-${overrides.id}`,
  ...overrides,
});

describe('matchShippingRule', () => {
  const context = { state: 'طرابلس', city: 'تاجوراء', total: 200_000, methodType: 'DELIVERY' as const };

  it('returns the lowest-priority matching rule', () => {
    const rules = [
      rule({ id: 'b', priority: 5, matchState: 'طرابلس' }),
      rule({ id: 'a', priority: 1, matchState: 'طرابلس' }),
    ];
    expect(matchShippingRule(rules, context)?.id).toBe('a');
  });

  it('skips inactive rules', () => {
    const rules = [
      rule({ id: 'off', priority: 1, isActive: false, matchState: 'طرابلس' }),
      rule({ id: 'on', priority: 2, matchState: 'طرابلس' }),
    ];
    expect(matchShippingRule(rules, context)?.id).toBe('on');
  });

  it('is stable when two rules share a priority', () => {
    const rules = [rule({ id: 'zzz', priority: 1 }), rule({ id: 'aaa', priority: 1 })];
    expect(matchShippingRule(rules, context)?.id).toBe('aaa');
    expect(matchShippingRule([...rules].reverse(), context)?.id).toBe('aaa');
  });

  it('returns null when nothing matches', () => {
    expect(matchShippingRule([rule({ id: 'x', matchCity: 'سبها' })], context)).toBeNull();
  });
});

describe('ruleMatches', () => {
  const context = { state: 'طرابلس', city: 'تاجوراء', total: 200_000, methodType: 'DELIVERY' as const };

  it('requires every stated condition, not just one', () => {
    expect(ruleMatches(rule({ id: 'r', matchState: 'طرابلس', matchCity: 'سبها' }), context)).toBe(false);
    expect(ruleMatches(rule({ id: 'r', matchState: 'طرابلس', matchCity: 'تاجوراء' }), context)).toBe(true);
  });

  it('treats total bounds as inclusive', () => {
    expect(ruleMatches(rule({ id: 'r', matchMinTotal: 200_000 }), context)).toBe(true);
    expect(ruleMatches(rule({ id: 'r', matchMaxTotal: 200_000 }), context)).toBe(true);
    expect(ruleMatches(rule({ id: 'r', matchMinTotal: 200_001 }), context)).toBe(false);
    expect(ruleMatches(rule({ id: 'r', matchMaxTotal: 199_999 }), context)).toBe(false);
  });

  it('matches everything when no condition is set', () => {
    expect(ruleMatches(rule({ id: 'r' }), context)).toBe(true);
  });

  it('respects the method type', () => {
    expect(ruleMatches(rule({ id: 'r', matchMethodType: 'PICKUP' }), context)).toBe(false);
    expect(ruleMatches(rule({ id: 'r', matchMethodType: 'DELIVERY' }), context)).toBe(true);
  });
});
