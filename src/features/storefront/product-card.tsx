'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  discountPercent: number;
  imageUrl: string | null;
  stockState: string;
  purchasable: boolean;
}

/**
 * Storefront product card.
 *
 * The whole card is one link — a shopper on a phone should not have to hit a
 * small title. Out-of-stock products stay visible and browsable but are marked
 * clearly rather than hidden.
 */
export function ProductCard({
  product,
  href,
  currency,
}: {
  product: ProductCardData;
  href: string;
  currency: string;
}) {
  const t = useTranslations('storefront');
  const locale = useLocale();

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-1 transition-colors duration-base hover:border-border-strong"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- merchant uploads live at arbitrary paths
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-slow group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-subtle-foreground">
            <Package className="size-8" aria-hidden />
          </span>
        )}

        {product.discountPercent > 0 ? (
          <span className="absolute top-2 inset-inline-start-0 start-2 rounded-[var(--radius-sm)] bg-danger px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {t('save', { percent: product.discountPercent })}
          </span>
        ) : null}

        {!product.purchasable ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-medium text-white">
            {t('outOfStock')}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
          {product.name}
        </h3>

        <div className="mt-auto flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatMoney(product.price, currency, locale)}
          </span>
          {product.compareAt && product.compareAt > product.price ? (
            <span className="text-xs tabular-nums text-subtle-foreground line-through">
              {formatMoney(product.compareAt, currency, locale)}
            </span>
          ) : null}
        </div>

        {product.purchasable && product.stockState === 'LOW_STOCK' ? (
          <Badge tone="warning" className={cn('self-start')}>
            {t('lowStock')}
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}
