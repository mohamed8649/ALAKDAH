/**
 * Shipping zone pricing and carrier rule matching.
 *
 * Two separate decisions, both pure and both deterministic:
 *   1. What does delivery cost for this destination? -> resolveShippingPrice
 *   2. Which carrier handles this order?             -> matchShippingRule
 *
 * Determinism matters: when two rules could match, the outcome must not depend
 * on database row order. Ties break on priority, then on rule id, so the same
 * order always routes to the same carrier.
 */

export type ShippingMethodType = 'DELIVERY' | 'PICKUP' | 'EXPRESS';

export interface ZoneInput {
  id: string;
  name: string;
  price: number;
  regions: readonly string[];
  cities: readonly string[];
  position: number;
}

export interface MethodInput {
  id: string;
  price: number;
  zones: readonly ZoneInput[];
}

export interface Destination {
  state: string;
  city: string;
}

export interface ShippingPriceResult {
  price: number;
  zoneId: string | null;
  zoneName: string | null;
  /** True when no zone matched and the method's base price was used. */
  usedBasePrice: boolean;
}

/**
 * Resolve the delivery price for a destination.
 *
 * Specificity wins: a zone naming the city beats a zone naming only the
 * region, which beats a catch-all zone (no regions and no cities), which beats
 * the method's base price.
 */
export function resolveShippingPrice(
  method: MethodInput,
  destination: Destination,
): ShippingPriceResult {
  const state = normalise(destination.state);
  const city = normalise(destination.city);

  let best: { zone: ZoneInput; score: number } | null = null;

  for (const zone of method.zones) {
    const cities = zone.cities.map(normalise);
    const regions = zone.regions.map(normalise);

    let score: number;
    if (city && cities.includes(city)) {
      score = 3;
    } else if (state && regions.includes(state)) {
      score = 2;
    } else if (regions.length === 0 && cities.length === 0) {
      score = 1;
    } else {
      continue;
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score && zone.position < best.zone.position)
    ) {
      best = { zone, score };
    }
  }

  if (!best) {
    return { price: method.price, zoneId: null, zoneName: null, usedBasePrice: true };
  }

  return {
    price: best.zone.price,
    zoneId: best.zone.id,
    zoneName: best.zone.name,
    usedBasePrice: false,
  };
}

export interface RuleInput {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  matchState: string | null;
  matchCity: string | null;
  matchMinTotal: number | null;
  matchMaxTotal: number | null;
  matchMethodType: ShippingMethodType | null;
  providerId: string;
}

export interface RuleContext {
  state: string;
  city: string;
  total: number;
  methodType: ShippingMethodType | null;
}

/**
 * Return the first matching carrier rule.
 *
 * All non-null conditions on a rule must match (AND). Rules are evaluated by
 * ascending priority; equal priorities break on id so the result is stable.
 */
export function matchShippingRule(
  rules: readonly RuleInput[],
  context: RuleContext,
): RuleInput | null {
  const ordered = [...rules]
    .filter((rule) => rule.isActive)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  for (const rule of ordered) {
    if (ruleMatches(rule, context)) return rule;
  }
  return null;
}

export function ruleMatches(rule: RuleInput, context: RuleContext): boolean {
  if (rule.matchState && normalise(rule.matchState) !== normalise(context.state)) return false;
  if (rule.matchCity && normalise(rule.matchCity) !== normalise(context.city)) return false;
  if (rule.matchMinTotal !== null && context.total < rule.matchMinTotal) return false;
  if (rule.matchMaxTotal !== null && context.total > rule.matchMaxTotal) return false;
  if (rule.matchMethodType && rule.matchMethodType !== context.methodType) return false;
  return true;
}

/**
 * Report rule pairs that could both match the same order. Surfaced in the UI so
 * a merchant can see an ambiguity instead of discovering it as a mis-routed
 * order weeks later.
 */
export function findOverlappingRules(rules: readonly RuleInput[]): Array<[RuleInput, RuleInput]> {
  const active = rules.filter((rule) => rule.isActive);
  const overlaps: Array<[RuleInput, RuleInput]> = [];

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i]!;
      const b = active[j]!;
      if (a.priority === b.priority && conditionsOverlap(a, b)) overlaps.push([a, b]);
    }
  }

  return overlaps;
}

function conditionsOverlap(a: RuleInput, b: RuleInput): boolean {
  if (!valueOverlap(a.matchState, b.matchState)) return false;
  if (!valueOverlap(a.matchCity, b.matchCity)) return false;
  if (a.matchMethodType && b.matchMethodType && a.matchMethodType !== b.matchMethodType) {
    return false;
  }

  const aMin = a.matchMinTotal ?? 0;
  const aMax = a.matchMaxTotal ?? Number.MAX_SAFE_INTEGER;
  const bMin = b.matchMinTotal ?? 0;
  const bMax = b.matchMaxTotal ?? Number.MAX_SAFE_INTEGER;
  return aMin <= bMax && bMin <= aMax;
}

function valueOverlap(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return true;
  return normalise(a) === normalise(b);
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}
