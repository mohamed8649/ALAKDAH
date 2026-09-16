'use client';

import { RefreshCw } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Switch } from '@/components/ui/misc';
import { useLocale, useTranslations } from '@/i18n/provider';
import { toDecimalString } from '@/lib/money';
import { cn } from '@/lib/cn';

import {
  combinationCount,
  exceedsVariantLimit,
  generateCombinations,
  MAX_VARIANTS,
  type OptionInput,
} from './variants';
import type { OptionDraft } from './option-editor';

export interface VariantDraft {
  signature: string;
  title: string;
  sku: string;
  price: string;
  stockQuantity: string;
  barcode: string;
  isActive: boolean;
  optionValueIds: string[];
}

/**
 * Variant matrix.
 *
 * Regeneration is explicit, not automatic: a merchant who is mid-way through
 * adding option values should not have their priced rows rebuilt on every
 * keystroke. Existing rows are matched by title, so regenerating after adding
 * one size keeps the prices already entered for the others.
 */
export function VariantEditor({
  options,
  variants,
  onChange,
  productPrice,
  currency,
  disabled,
}: {
  options: OptionDraft[];
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  productPrice: string;
  currency: string;
  disabled?: boolean;
}) {
  const t = useTranslations('products.variants');
  const locale = useLocale();

  const usableOptions = useMemo<OptionInput[]>(
    () =>
      options
        .filter((option) => option.name.trim() && option.values.length > 0)
        .map((option, index) => ({
          id: option.id,
          name: option.name,
          position: index,
          values: option.values.map((value, valueIndex) => ({
            id: value.id,
            value: value.value,
            position: valueIndex,
          })),
        })),
    [options],
  );

  const pending = useMemo(() => {
    if (usableOptions.length === 0) return null;
    const combinations = generateCombinations(usableOptions);
    const existingTitles = new Set(variants.map((variant) => variant.title));
    return {
      combinations,
      created: combinations.filter((combination) => !existingTitles.has(combination.title)).length,
      kept: combinations.filter((combination) => existingTitles.has(combination.title)).length,
      total: combinations.length,
    };
  }, [usableOptions, variants]);

  const overLimit = exceedsVariantLimit(usableOptions);

  const regenerate = () => {
    if (!pending || overLimit) return;

    const byTitle = new Map(variants.map((variant) => [variant.title, variant]));

    onChange(
      pending.combinations.map((combination) => {
        const existing = byTitle.get(combination.title);
        return {
          signature: combination.signature,
          title: combination.title,
          optionValueIds: combination.optionValueIds,
          sku: existing?.sku ?? '',
          price: existing?.price ?? '',
          stockQuantity: existing?.stockQuantity ?? '0',
          barcode: existing?.barcode ?? '',
          isActive: existing?.isActive ?? true,
        };
      }),
    );
  };

  const update = (index: number, patch: Partial<VariantDraft>) => {
    onChange(variants.map((variant, position) => (position === index ? { ...variant, ...patch } : variant)));
  };

  if (usableOptions.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-4 text-center text-xs text-subtle-foreground">
        {t('empty')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {pending ? (
            <>
              <span className="font-medium text-foreground">
                {t('count', { count: pending.total })}
              </span>
              {pending.created > 0 ? (
                <span className="ms-2">{t('willCreate', { count: pending.created })}</span>
              ) : null}
              {pending.kept > 0 ? (
                <span className="ms-2">{t('willKeep', { count: pending.kept })}</span>
              ) : null}
            </>
          ) : null}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={regenerate}
          disabled={disabled || overLimit}
        >
          <RefreshCw aria-hidden />
          {variants.length > 0 ? t('regenerate') : t('generate')}
        </Button>
      </div>

      {overLimit ? (
        <p className="rounded-[var(--radius)] border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-xs text-warning">
          {combinationCount(usableOptions)} &gt; {MAX_VARIANTS}
        </p>
      ) : null}

      {variants.length > 0 ? (
        <div className="scrollbar-thin overflow-x-auto rounded-[var(--radius)] border border-border">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th scope="col" className="px-3 py-2 text-start text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                  {t('variant')}
                </th>
                <th scope="col" className="px-3 py-2 text-start text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                  {t('sku')}
                </th>
                <th scope="col" className="w-32 px-3 py-2 text-start text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                  {t('price')}
                </th>
                <th scope="col" className="w-24 px-3 py-2 text-start text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                  {t('stock')}
                </th>
                <th scope="col" className="w-16 px-3 py-2 text-start text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                  {t('active')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {variants.map((variant, index) => (
                <tr key={variant.signature} className={cn(!variant.isActive && 'opacity-50')}>
                  <td className="px-3 py-2 font-medium text-foreground">{variant.title}</td>
                  <td className="px-3 py-2">
                    <Input
                      value={variant.sku}
                      onChange={(event) => update(index, { sku: event.target.value })}
                      disabled={disabled}
                      dir="ltr"
                      aria-label={`${variant.title} ${t('sku')}`}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={variant.price}
                      onChange={(event) => update(index, { price: event.target.value })}
                      disabled={disabled}
                      inputMode="decimal"
                      placeholder={productPrice ? toDecimalString(0, currency) : ''}
                      aria-label={`${variant.title} ${t('price')}`}
                      title={t('inheritPrice')}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={variant.stockQuantity}
                      onChange={(event) => update(index, { stockQuantity: event.target.value })}
                      disabled={disabled}
                      inputMode="numeric"
                      aria-label={`${variant.title} ${t('stock')}`}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={variant.isActive}
                      onCheckedChange={(checked) => update(index, { isActive: checked })}
                      disabled={disabled}
                      aria-label={`${variant.title} ${t('active')}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-2xs text-subtle-foreground" lang={locale}>
        {t('inheritPrice')}
      </p>
    </div>
  );
}
