'use client';

import { useRouter } from 'next/navigation';
import { Check, Minus, Package, Plus, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { trackEventAction } from '@/app/actions/checkout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useLocale, useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

import { useCart } from './cart-store';
import { ProductCard, type ProductCardData } from './product-card';
import { TrustBadgeRow } from './trust-badges';

interface OptionGroup {
  id: string;
  name: string;
  values: Array<{ id: string; value: string }>;
}

interface Variant {
  id: string;
  title: string;
  price: number;
  compareAt: number | null;
  stockQuantity: number;
  purchasable: boolean;
  optionValueIds: string[];
}

export interface ProductDetailData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: number;
  compareAt: number | null;
  discountPercent: number;
  campaignName: string | null;
  images: Array<{ id: string; url: string; altText: string | null }>;
  options: OptionGroup[];
  variants: Variant[];
  offers: Array<{ id: string; title: string; minQuantity: number; discountPercent: number | null }>;
  related: ProductCardData[];
  stockState: string;
  purchasable: boolean;
  trackInventory: boolean;
  stockQuantity: number;
}

/**
 * Product page.
 *
 * Variant selection is by option value, not by picking a variant from a list:
 * a shopper thinks "black, large", not "variant #7". Combinations that do not
 * exist are disabled rather than hidden, so the shopper can see what the
 * product offers and what is unavailable.
 *
 * The purchase CTA is sticky at the bottom on mobile, which is where the
 * reference puts it and where a thumb can reach it.
 */
export function ProductDetail({
  product,
  store,
  badges,
  cartEnabled,
  locale,
}: {
  product: ProductDetailData;
  store: { slug: string; currency: string };
  badges: Array<{ id: string; title: string; description: string | null; icon: string }>;
  cartEnabled: boolean;
  locale: string;
}) {
  const t = useTranslations('storefront');
  const currentLocale = useLocale();
  const router = useRouter();
  const { add, sessionId } = useCart();
  const { toast } = useToast();

  const [activeImage, setActiveImage] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    // Preselect the first in-stock variant's values so a shopper can buy in one
    // tap when there is an obvious default.
    const firstAvailable = product.variants.find((variant) => variant.purchasable);
    if (!firstAvailable) return {};

    const map: Record<string, string> = {};
    for (const option of product.options) {
      const match = option.values.find((value) =>
        firstAvailable.optionValueIds.includes(value.id),
      );
      if (match) map[option.id] = match.id;
    }
    return map;
  });
  const [quantity, setQuantity] = useState(1);

  // One product_viewed event per mount, fire-and-forget.
  useEffect(() => {
    void trackEventAction({
      storeSlug: store.slug,
      name: 'product_viewed',
      productId: product.id,
      sessionId,
      path: `/${product.slug}`,
    });
  }, [product.id, product.slug, store.slug, sessionId]);

  const selectedVariant = useMemo<Variant | null>(() => {
    if (product.options.length === 0) return null;

    const chosen = Object.values(selected);
    if (chosen.length !== product.options.length) return null;

    return (
      product.variants.find(
        (variant) =>
          chosen.every((valueId) => variant.optionValueIds.includes(valueId)) &&
          variant.optionValueIds.length === chosen.length,
      ) ?? null
    );
  }, [product.options.length, product.variants, selected]);

  /** Whether any variant exists that includes this option value. */
  const valueAvailable = (optionId: string, valueId: string): boolean => {
    const others = Object.entries(selected).filter(([key]) => key !== optionId);
    return product.variants.some(
      (variant) =>
        variant.purchasable &&
        variant.optionValueIds.includes(valueId) &&
        others.every(([, otherValue]) => variant.optionValueIds.includes(otherValue)),
    );
  };

  const needsSelection = product.options.length > 0 && selectedVariant === null;
  const price = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant?.compareAt ?? product.compareAt;
  const purchasable = selectedVariant ? selectedVariant.purchasable : product.purchasable;

  const addToCart = (): boolean => {
    if (needsSelection) {
      toast({ title: t('quantity'), description: product.options.map((o) => o.name).join('، '), tone: 'warning' });
      return false;
    }
    if (!purchasable) return false;

    add(
      {
        productId: product.id,
        variantId: selectedVariant?.id ?? null,
        name: product.name,
        variantTitle: selectedVariant?.title ?? null,
        slug: product.slug,
        price,
        imageUrl: product.images[0]?.url ?? null,
      },
      quantity,
    );

    void trackEventAction({
      storeSlug: store.slug,
      name: 'add_to_cart',
      productId: product.id,
      sessionId,
      value: price * quantity,
    });

    return true;
  };

  const base = `/${locale}/${store.slug}`;

  const buyNow = () => {
    if (!addToCart()) return;
    router.push(`${base}/checkout`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:pb-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-3">
            {product.images[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element -- merchant uploads at arbitrary paths
              <img
                src={product.images[activeImage]!.url}
                alt={product.images[activeImage]!.altText ?? product.name}
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-subtle-foreground">
                <Package className="size-10" aria-hidden />
              </span>
            )}
          </div>

          {product.images.length > 1 ? (
            <ul className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {product.images.map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`${product.name} ${index + 1}`}
                    aria-current={index === activeImage}
                    className={cn(
                      'size-16 shrink-0 overflow-hidden rounded-[var(--radius)] border-2 transition-colors duration-fast',
                      index === activeImage ? 'border-primary' : 'border-border',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
                    <img src={image.url} alt="" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Buy box */}
        <div>
          <h1 className="text-xl font-semibold leading-snug text-foreground sm:text-2xl">
            {product.name}
          </h1>

          {product.shortDescription ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {formatMoney(price, store.currency, currentLocale)}
            </span>
            {compareAt && compareAt > price ? (
              <>
                <span className="text-base tabular-nums text-subtle-foreground line-through">
                  {formatMoney(compareAt, store.currency, currentLocale)}
                </span>
                <Badge tone="danger" size="md">
                  {t('save', { percent: Math.round(((compareAt - price) / compareAt) * 100) })}
                </Badge>
              </>
            ) : null}
          </div>

          {product.campaignName ? (
            <p className="mt-1.5 text-xs text-primary">{product.campaignName}</p>
          ) : null}

          <div className="mt-3">
            {purchasable ? (
              <Badge tone={product.stockState === 'LOW_STOCK' ? 'warning' : 'success'} dot>
                {product.stockState === 'LOW_STOCK' ? t('lowStock') : t('inStock')}
              </Badge>
            ) : (
              <Badge tone="danger" dot>
                {t('outOfStock')}
              </Badge>
            )}
          </div>

          {/* Options */}
          {product.options.length > 0 ? (
            <div className="mt-5 space-y-4">
              {product.options.map((option) => (
                <fieldset key={option.id}>
                  <legend className="mb-2 text-[13px] font-medium text-foreground">
                    {option.name}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const isSelected = selected[option.id] === value.id;
                      const available = valueAvailable(option.id, value.id);

                      return (
                        <button
                          key={value.id}
                          type="button"
                          disabled={!available}
                          aria-pressed={isSelected}
                          onClick={() =>
                            setSelected((current) => ({ ...current, [option.id]: value.id }))
                          }
                          className={cn(
                            'min-h-11 rounded-[var(--radius)] border px-4 text-[13px] transition-colors duration-fast',
                            isSelected
                              ? 'border-primary bg-[var(--primary-soft)] font-medium text-primary'
                              : 'border-border text-foreground hover:border-border-strong',
                            !available && 'cursor-not-allowed opacity-40 line-through',
                          )}
                        >
                          {value.value}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}

          {/* Offers */}
          {product.offers.length > 0 ? (
            <ul className="mt-5 space-y-1.5">
              {product.offers.map((offer) => (
                <li
                  key={offer.id}
                  className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-3 py-2 text-xs text-primary"
                >
                  <Check className="size-3.5 shrink-0" aria-hidden />
                  {offer.title}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Quantity */}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[13px] font-medium text-foreground">{t('quantity')}</span>
            <div className="flex items-center rounded-[var(--radius)] border border-border">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                disabled={quantity <= 1}
                aria-label="-"
                className="flex size-11 items-center justify-center text-foreground disabled:opacity-40"
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="w-10 text-center text-sm tabular-nums text-foreground">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.min(99, current + 1))}
                aria-label="+"
                className="flex size-11 items-center justify-center text-foreground"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Desktop CTAs */}
          <div className="mt-5 hidden gap-2 lg:flex">
            {cartEnabled ? (
              <Button
                variant="secondary"
                size="touch"
                className="flex-1"
                disabled={!purchasable}
                onClick={() => {
                  if (addToCart()) toast({ title: t('addToCart'), tone: 'success' });
                }}
              >
                <ShoppingCart aria-hidden />
                {t('addToCart')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="touch"
              className="flex-1"
              disabled={!purchasable}
              onClick={buyNow}
            >
              {cartEnabled ? t('buyNow') : t('orderNow')}
            </Button>
          </div>

          {!purchasable ? (
            <p className="mt-3 text-xs text-danger">{t('outOfStock')}</p>
          ) : null}

          {badges.length > 0 ? (
            <div className="mt-6">
              <TrustBadgeRow badges={badges} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Description */}
      {product.description ? (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t('productDescription')}</h2>
          {/* Rendered as plain text with preserved line breaks. Merchant
              descriptions are never injected as HTML. */}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        </section>
      ) : null}

      {/* Related */}
      {product.related.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t('relatedProducts')}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {product.related.map((related) => (
              <li key={related.id}>
                <ProductCard
                  product={related}
                  href={`${base}/products/${related.slug}`}
                  currency={store.currency}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Mobile sticky CTA — sits above the safe area so it never sits under
          the home indicator, and leaves room for the quick-contact buttons. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-border bg-surface-1 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        {cartEnabled ? (
          <Button
            variant="secondary"
            size="touch"
            className="flex-1"
            disabled={!purchasable}
            onClick={() => {
              if (addToCart()) toast({ title: t('addToCart'), tone: 'success' });
            }}
          >
            <ShoppingCart aria-hidden />
            {t('addToCart')}
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="touch"
          className="flex-1"
          disabled={!purchasable}
          onClick={buyNow}
        >
          {cartEnabled ? t('buyNow') : t('orderNow')}
        </Button>
      </div>
    </div>
  );
}
