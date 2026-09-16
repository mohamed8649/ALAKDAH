'use client';

import Link from 'next/link';
import { Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatMoney } from '@/lib/money';

import { useCart } from './cart-store';

/**
 * Cart.
 *
 * Renders a skeleton until the cart has hydrated from localStorage — showing an
 * "empty cart" state for a frame and then filling it in reads as a bug.
 */
export function CartView({
  storeSlug,
  currency,
  locale,
}: {
  storeSlug: string;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('storefront');
  const tApp = useTranslations('app');
  const currentLocale = useLocale();
  const { lines, setQuantity, remove, subtotal, hydrated } = useCart();

  const base = `/${locale}/${storeSlug}`;

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState
          icon={<ShoppingCart />}
          title={t('emptyCart')}
          description={t('emptyCartHint')}
          action={
            <Button asChild variant="primary" size="touch">
              <Link href={`${base}/products`}>{t('continueShopping')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold text-foreground">{t('cart')}</h1>

      <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface-1">
        {lines.map((line) => (
          <li key={`${line.productId}-${line.variantId ?? 'base'}`} className="flex gap-3 p-3">
            {line.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- merchant uploads at arbitrary paths
              <img
                src={line.imageUrl}
                alt=""
                className="size-16 shrink-0 rounded-[var(--radius)] object-cover"
              />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius)] bg-surface-3 text-subtle-foreground">
                <Package className="size-5" aria-hidden />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <Link
                href={`${base}/products/${line.slug}`}
                className="line-clamp-2 text-[13px] font-medium text-foreground hover:text-primary"
              >
                {line.name}
              </Link>
              {line.variantTitle ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{line.variantTitle}</p>
              ) : null}
              <p className="mt-1 text-[13px] font-medium tabular-nums text-foreground">
                {formatMoney(line.price, currency, currentLocale)}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-[var(--radius)] border border-border">
                  <button
                    type="button"
                    aria-label="-"
                    onClick={() =>
                      setQuantity(line.productId, line.variantId, line.quantity - 1)
                    }
                    className="flex size-9 items-center justify-center text-foreground"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <span className="w-8 text-center text-[13px] tabular-nums text-foreground">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() =>
                      setQuantity(line.productId, line.variantId, line.quantity + 1)
                    }
                    className="flex size-9 items-center justify-center text-foreground"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </div>

                <IconButton
                  label={t('removeItem')}
                  icon={<Trash2 />}
                  variant="danger"
                  size="sm"
                  onClick={() => remove(line.productId, line.variantId)}
                />
              </div>
            </div>

            <div className="shrink-0 text-end">
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatMoney(line.price * line.quantity, currency, currentLocale)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-[var(--radius-lg)] border border-border bg-surface-1 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">{t('cartSubtotal')}</span>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {formatMoney(subtotal, currency, currentLocale)}
          </span>
        </div>
        <p className="mt-1 text-xs text-subtle-foreground">{t('shippingCalculated')}</p>

        <Button asChild variant="primary" size="touch" block className="mt-4">
          <Link href={`${base}/checkout`}>{t('proceedToCheckout')}</Link>
        </Button>

        <Button asChild variant="ghost" size="sm" block className="mt-2">
          <Link href={`${base}/products`}>{t('continueShopping')}</Link>
        </Button>
      </div>

      <p className="sr-only">{tApp('total')}</p>
    </div>
  );
}
