'use client';

import { Package, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { searchProductsAction } from '@/app/actions/products';
import { Input } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { useTranslations } from '@/i18n/provider';
import { formatMoney } from '@/lib/money';

/**
 * Related products picker.
 *
 * Manual selection first, as the reference shows. Search is debounced and
 * cancellable: a slower earlier request can never overwrite the results of a
 * newer query.
 */

export interface RelatedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
}

const MAX_RELATED = 12;

export function RelatedProductsPicker({
  value,
  onChange,
  excludeId,
  currency,
  locale,
}: {
  value: RelatedProduct[];
  onChange: (products: RelatedProduct[]) => void;
  excludeId: string | null;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('products.related');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RelatedProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const id = ++requestId.current;
    setSearching(true);

    const timer = setTimeout(async () => {
      const response = await searchProductsAction(query);
      // Drop the response if a newer search has already been issued.
      if (id !== requestId.current) return;

      setSearching(false);
      if (response.ok) {
        setResults(
          response.data
            .filter((product) => product.id !== excludeId)
            .filter((product) => !value.some((selected) => selected.id === product.id))
            .map((product) => ({
              id: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl,
            })),
        );
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, excludeId, value]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-inline-start-0 start-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="ps-8"
          disabled={value.length >= MAX_RELATED}
        />
      </div>

      {searching ? (
        <p className="text-xs text-subtle-foreground">…</p>
      ) : results.length > 0 ? (
        <ul className="max-h-56 overflow-y-auto rounded-[var(--radius)] border border-border">
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, product]);
                  setQuery('');
                  setResults([]);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors duration-fast hover:bg-surface-2"
              >
                <Thumb url={product.imageUrl} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                  {product.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatMoney(product.price, currency, locale)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {value.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-4 text-center text-xs text-subtle-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((product, index) => (
            <li
              key={product.id}
              className="flex items-center gap-2.5 rounded-[var(--radius)] border border-border px-3 py-2"
            >
              <Thumb url={product.imageUrl} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{product.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatMoney(product.price, currency, locale)}
              </span>
              <IconButton
                label="إزالة"
                icon={<X />}
                size="sm"
                variant="danger"
                onClick={() => onChange(value.filter((_, position) => position !== index))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-3 text-subtle-foreground">
        <Package className="size-4" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- arbitrary upload paths
  return <img src={url} alt="" className="size-8 shrink-0 rounded-[var(--radius-sm)] object-cover" />;
}
