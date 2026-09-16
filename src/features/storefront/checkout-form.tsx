'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  quoteShippingAction,
  submitCheckoutAction,
  trackAbandonedAction,
  trackEventAction,
} from '@/app/actions/checkout';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { RadioGroup, RadioItem } from '@/components/ui/misc';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useLocale, useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

import { useCart } from './cart-store';
import { TrustBadgeRow } from './trust-badges';

export interface CheckoutField {
  fieldKey: string;
  mode: 'REQUIRED' | 'OPTIONAL' | 'HIDDEN';
}

export interface CustomFieldDef {
  id: string;
  fieldKey: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RADIO' | 'CHECKBOX' | 'NUMBER';
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  options: string[];
}

interface ShippingOption {
  methodId: string;
  methodName: string;
  price: number;
  type: string;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
}

/**
 * COD checkout.
 *
 * Which fields appear, and whether each is required, comes entirely from the
 * merchant's checkout configuration — changing the form needs no code change.
 * The server re-validates the same configuration, so hiding a field in the UI
 * is presentation, not enforcement.
 *
 * The total shown updates live as the shopper picks a region, but the charged
 * total is recomputed server-side from the catalogue and zone table.
 */
export function CheckoutForm({
  store,
  fields,
  customFields,
  badges,
  regions,
  locale,
  codNotice,
}: {
  store: { slug: string; currency: string; country: string; cartEnabled: boolean };
  fields: CheckoutField[];
  customFields: CustomFieldDef[];
  badges: Array<{ id: string; title: string; description: string | null; icon: string }>;
  regions: string[];
  locale: string;
  codNotice: boolean;
}) {
  const t = useTranslations('storefront');
  const tApp = useTranslations('app');
  const tCheckout = useTranslations('settings.checkout.fields');
  const currentLocale = useLocale();
  const router = useRouter();
  const { lines, subtotal, clear, sessionId, hydrated } = useCart();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingMethodId, setShippingMethodId] = useState('');
  const [quotePending, setQuotePending] = useState(false);

  const action = useServerAction(submitCheckoutAction);
  const abandonedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mode = (key: string) => fields.find((field) => field.fieldKey === key)?.mode ?? 'HIDDEN';
  const visible = (key: string) => mode(key) !== 'HIDDEN';
  const required = (key: string) => mode(key) === 'REQUIRED';

  // checkout_started, once, when the shopper actually has a cart.
  useEffect(() => {
    if (!hydrated || lines.length === 0) return;
    void trackEventAction({
      storeSlug: store.slug,
      name: 'checkout_started',
      sessionId,
      value: subtotal,
    });
    // Intentionally only on first arrival with a non-empty cart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, lines.length > 0]);

  // Re-quote shipping when the destination changes. Debounced, because the
  // region and city fields are typed into.
  useEffect(() => {
    if (!state && !city) return;

    const timer = setTimeout(async () => {
      setQuotePending(true);
      const result = await quoteShippingAction(store.slug, { state, city });
      setQuotePending(false);

      if (!result.ok) return;
      setShippingOptions(result.data);
      setShippingMethodId((current) =>
        current && result.data.some((option) => option.methodId === current)
          ? current
          : (result.data[0]?.methodId ?? ''),
      );
    }, 400);

    return () => clearTimeout(timer);
  }, [state, city, store.slug]);

  // Abandoned-checkout snapshot. Debounced and only ever sends what the shopper
  // typed; the server drops it entirely when the app is disabled.
  useEffect(() => {
    if (!hydrated || lines.length === 0 || !sessionId) return;

    if (abandonedTimer.current) clearTimeout(abandonedTimer.current);
    abandonedTimer.current = setTimeout(() => {
      void trackAbandonedAction({
        storeSlug: store.slug,
        sessionId,
        step: address ? 'address' : customerPhone ? 'contact' : 'started',
        cart: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          name: line.name,
        })),
        value: subtotal,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        state: state || null,
        city: city || null,
      });
    }, 1500);

    return () => {
      if (abandonedTimer.current) clearTimeout(abandonedTimer.current);
    };
  }, [hydrated, lines, subtotal, customerName, customerPhone, state, city, address, sessionId, store.slug]);

  const selectedShipping = shippingOptions.find((option) => option.methodId === shippingMethodId);
  const shippingAmount = selectedShipping?.price ?? 0;
  const total = subtotal + shippingAmount;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await action.run({
      storeSlug: store.slug,
      items: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
      })),
      customerName,
      customerPhone,
      customerEmail,
      state,
      city,
      address,
      notes,
      shippingMethodId: shippingMethodId || null,
      customFields: customValues,
      sessionId,
    });

    if (!result) return;

    clear();
    router.replace(
      `/${locale}/${store.slug}/order-success?order=${encodeURIComponent(result.orderNumber)}`,
    );
  };

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <Skeleton className="h-64 w-full" />
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
              <Link href={`/${locale}/${store.slug}/products`}>{t('continueShopping')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-4xl px-4 py-6 pb-28 lg:pb-8">
      <h1 className="mb-4 text-lg font-semibold text-foreground">{t('checkout')}</h1>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <FormError message={action.error} />

          {codNotice ? (
            <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-3 py-2.5 text-[13px] text-primary">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              {t('codNotice')}
            </p>
          ) : null}

          <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{t('deliveryDetails')}</h2>

            <div className="space-y-4">
              {visible('customerName') ? (
                <Field
                  label={tCheckout('customerName')}
                  required={required('customerName')}
                  error={action.fieldError('customerName')}
                >
                  <Input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="name"
                  />
                </Field>
              ) : null}

              <Field label={tCheckout('phone')} required error={action.fieldError('phone')}>
                <Input
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  autoComplete="tel"
                  placeholder="091 234 5678"
                />
              </Field>

              {visible('email') ? (
                <Field
                  label={tCheckout('email')}
                  required={required('email')}
                  optionalLabel={required('email') ? undefined : tApp('optional')}
                  error={action.fieldError('email')}
                >
                  <Input
                    type="email"
                    dir="ltr"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    autoComplete="email"
                  />
                </Field>
              ) : null}

              {visible('state') ? (
                <Field
                  label={tCheckout('state')}
                  required={required('state')}
                  error={action.fieldError('state')}
                >
                  {regions.length > 0 ? (
                    <NativeSelect value={state} onChange={(event) => setState(event.target.value)}>
                      <option value="">{t('selectRegion')}</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input value={state} onChange={(event) => setState(event.target.value)} />
                  )}
                </Field>
              ) : null}

              {visible('city') ? (
                <Field
                  label={tCheckout('city')}
                  required={required('city')}
                  error={action.fieldError('city')}
                >
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    autoComplete="address-level2"
                  />
                </Field>
              ) : null}

              {visible('address') ? (
                <Field
                  label={tCheckout('address')}
                  required={required('address')}
                  error={action.fieldError('address')}
                >
                  <Textarea
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    rows={2}
                    autoComplete="street-address"
                  />
                </Field>
              ) : null}

              {customFields.map((field) => (
                <Field
                  key={field.id}
                  label={field.label}
                  required={field.required}
                  hint={field.helpText ?? undefined}
                  error={action.fieldError(`custom.${field.fieldKey}`)}
                >
                  {field.type === 'TEXTAREA' ? (
                    <Textarea
                      rows={2}
                      placeholder={field.placeholder ?? undefined}
                      value={customValues[field.fieldKey] ?? ''}
                      onChange={(event) =>
                        setCustomValues((current) => ({
                          ...current,
                          [field.fieldKey]: event.target.value,
                        }))
                      }
                    />
                  ) : field.type === 'SELECT' ? (
                    <NativeSelect
                      value={customValues[field.fieldKey] ?? ''}
                      onChange={(event) =>
                        setCustomValues((current) => ({
                          ...current,
                          [field.fieldKey]: event.target.value,
                        }))
                      }
                    >
                      <option value="">—</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : field.type === 'RADIO' ? (
                    <RadioGroup
                      value={customValues[field.fieldKey] ?? ''}
                      onValueChange={(value) =>
                        setCustomValues((current) => ({ ...current, [field.fieldKey]: value }))
                      }
                      className="flex flex-wrap gap-3"
                    >
                      {field.options.map((option) => (
                        <label key={option} className="flex items-center gap-2 text-[13px]">
                          <RadioItem value={option} />
                          {option}
                        </label>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Input
                      type={field.type === 'NUMBER' ? 'text' : 'text'}
                      inputMode={field.type === 'NUMBER' ? 'numeric' : undefined}
                      placeholder={field.placeholder ?? undefined}
                      value={customValues[field.fieldKey] ?? ''}
                      onChange={(event) =>
                        setCustomValues((current) => ({
                          ...current,
                          [field.fieldKey]: event.target.value,
                        }))
                      }
                    />
                  )}
                </Field>
              ))}

              {visible('notes') ? (
                <Field label={tCheckout('notes')} optionalLabel={tApp('optional')}>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                  />
                </Field>
              ) : null}
            </div>
          </section>

          {visible('deliveryType') && shippingOptions.length > 0 ? (
            <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                {tCheckout('deliveryType')}
              </h2>

              <RadioGroup
                value={shippingMethodId}
                onValueChange={setShippingMethodId}
                className="space-y-2"
              >
                {shippingOptions.map((option) => (
                  <label
                    key={option.methodId}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius)] border px-3 py-2.5',
                      'transition-colors duration-fast',
                      shippingMethodId === option.methodId
                        ? 'border-primary bg-[var(--primary-soft)]'
                        : 'border-border hover:border-border-strong',
                    )}
                  >
                    <RadioItem value={option.methodId} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-foreground">{option.methodName}</span>
                      {option.minDeliveryDays != null ? (
                        <span className="block text-2xs text-subtle-foreground">
                          {option.minDeliveryDays}–{option.maxDeliveryDays ?? option.minDeliveryDays}{' '}
                          {locale === 'ar' ? 'يوم' : 'days'}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
                      {option.price === 0
                        ? t('freeShipping')
                        : formatMoney(option.price, store.currency, currentLocale)}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </section>
          ) : null}

          {badges.length > 0 ? <TrustBadgeRow badges={badges} /> : null}
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-4 lg:sticky lg:top-20">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{t('orderSummary')}</h2>

            <ul className="space-y-2.5">
              {lines.map((line) => (
                <li
                  key={`${line.productId}-${line.variantId ?? 'base'}`}
                  className="flex items-start gap-2.5"
                >
                  {line.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- merchant uploads
                    <img
                      src={line.imageUrl}
                      alt=""
                      className="size-10 shrink-0 rounded-[var(--radius-sm)] object-cover"
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-3 text-subtle-foreground">
                      <Package className="size-4" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">{line.name}</span>
                    {line.variantTitle ? (
                      <span className="block truncate text-2xs text-subtle-foreground">
                        {line.variantTitle}
                      </span>
                    ) : null}
                    <span className="block text-2xs text-subtle-foreground">×{line.quantity}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-foreground">
                    {formatMoney(line.price * line.quantity, store.currency, currentLocale)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{tApp('subtotal')}</dt>
                <dd className="tabular-nums text-foreground">
                  {formatMoney(subtotal, store.currency, currentLocale)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="size-3.5" aria-hidden />
                  {tApp('shipping')}
                </dt>
                <dd className="tabular-nums text-foreground">
                  {quotePending
                    ? '…'
                    : shippingOptions.length === 0
                      ? t('shippingCalculated')
                      : shippingAmount === 0
                        ? t('freeShipping')
                        : formatMoney(shippingAmount, store.currency, currentLocale)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="font-medium text-foreground">{tApp('total')}</dt>
                <dd className="text-lg font-bold tabular-nums text-foreground">
                  {formatMoney(total, store.currency, currentLocale)}
                </dd>
              </div>
            </dl>

            <Button
              type="submit"
              variant="primary"
              size="touch"
              block
              className="mt-4 hidden lg:flex"
              loading={action.submitting}
            >
              {action.submitting ? t('placingOrder') : t('placeOrder')}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sticky submit */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-1 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">{tApp('total')}</span>
          <span className="text-base font-bold tabular-nums text-foreground">
            {formatMoney(total, store.currency, currentLocale)}
          </span>
        </div>
        <Button type="submit" variant="primary" size="touch" block loading={action.submitting}>
          {action.submitting ? t('placingOrder') : t('placeOrder')}
        </Button>
      </div>
    </form>
  );
}
