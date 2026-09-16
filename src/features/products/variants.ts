/**
 * Deterministic variant generation.
 *
 * Given options (Colour: Black/White, Size: M/L) the generator produces the
 * cartesian product in a stable order and identifies each combination by a
 * signature — the option-value ids sorted and joined. The signature is what
 * makes regeneration safe: an existing variant is matched by signature and
 * keeps its price, SKU and stock, so adding a third size never resets the
 * merchant's data on the six variants they already priced.
 */

export interface OptionInput {
  id: string;
  name: string;
  position: number;
  values: Array<{ id: string; value: string; position: number }>;
}

export interface GeneratedCombination {
  signature: string;
  title: string;
  optionValueIds: string[];
  position: number;
}

/** Stable identity for a combination, independent of option ordering. */
export function combinationSignature(optionValueIds: readonly string[]): string {
  return [...optionValueIds].sort().join(':');
}

export function generateCombinations(options: readonly OptionInput[]): GeneratedCombination[] {
  const usable = options
    .filter((option) => option.values.length > 0)
    .map((option) => ({
      ...option,
      values: [...option.values].sort(byPosition),
    }))
    .sort(byPosition);

  if (usable.length === 0) return [];

  let rows: Array<{ ids: string[]; labels: string[] }> = [{ ids: [], labels: [] }];

  for (const option of usable) {
    const next: Array<{ ids: string[]; labels: string[] }> = [];
    for (const row of rows) {
      for (const value of option.values) {
        next.push({ ids: [...row.ids, value.id], labels: [...row.labels, value.value] });
      }
    }
    rows = next;
  }

  const seen = new Set<string>();
  const combinations: GeneratedCombination[] = [];

  rows.forEach((row) => {
    const signature = combinationSignature(row.ids);
    // Two option values from different options can never collide, but a
    // malformed input (the same value id listed twice) would. Skip rather than
    // create a duplicate row that violates the unique index.
    if (seen.has(signature)) return;
    seen.add(signature);

    combinations.push({
      signature,
      title: row.labels.join(' / '),
      optionValueIds: row.ids,
      position: combinations.length,
    });
  });

  return combinations;
}

export interface ExistingVariant {
  id: string;
  signature: string;
}

export interface VariantReconciliation<T extends ExistingVariant> {
  /** Combinations with no existing variant — insert these. */
  toCreate: GeneratedCombination[];
  /** Existing variants that still match a combination — keep their data. */
  toKeep: Array<{ variant: T; combination: GeneratedCombination }>;
  /** Existing variants whose combination no longer exists — delete these. */
  toRemove: T[];
}

/**
 * Diff a freshly generated combination set against what is already stored.
 * The caller applies the result inside one transaction.
 */
export function reconcileVariants<T extends ExistingVariant>(
  combinations: readonly GeneratedCombination[],
  existing: readonly T[],
): VariantReconciliation<T> {
  const bySignature = new Map(existing.map((variant) => [variant.signature, variant]));
  const wanted = new Set(combinations.map((combination) => combination.signature));

  const toCreate: GeneratedCombination[] = [];
  const toKeep: Array<{ variant: T; combination: GeneratedCombination }> = [];

  for (const combination of combinations) {
    const match = bySignature.get(combination.signature);
    if (match) toKeep.push({ variant: match, combination });
    else toCreate.push(combination);
  }

  const toRemove = existing.filter((variant) => !wanted.has(variant.signature));

  return { toCreate, toKeep, toRemove };
}

/**
 * Derive a variant SKU from the product SKU and the combination labels.
 * "SHIRT-01" + "Black / M" -> "SHIRT-01-BLACK-M".
 */
export function suggestVariantSku(productSku: string | null, title: string): string | null {
  if (!productSku) return null;
  const suffix = title
    .split('/')
    .map((part) =>
      part
        .trim()
        .toUpperCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .slice(0, 8),
    )
    .filter(Boolean)
    .join('-');
  return suffix ? `${productSku}-${suffix}` : productSku;
}

function byPosition(a: { position: number }, b: { position: number }): number {
  return a.position - b.position;
}

/** Guard against a combinatorial explosion that would lock up the editor. */
export const MAX_VARIANTS = 200;

export function combinationCount(options: readonly OptionInput[]): number {
  return options
    .filter((option) => option.values.length > 0)
    .reduce((total, option) => total * option.values.length, 1);
}

export function exceedsVariantLimit(options: readonly OptionInput[]): boolean {
  const optionsWithValues = options.filter((option) => option.values.length > 0);
  if (optionsWithValues.length === 0) return false;
  return combinationCount(optionsWithValues) > MAX_VARIANTS;
}
