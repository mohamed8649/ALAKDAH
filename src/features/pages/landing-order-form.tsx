'use client';

import { useRouter } from 'next/navigation';
import { Minus, Plus, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  quoteShippingAction,
  submitCheckoutAction,
  trackEventAction,
} from '@/app/actions/checkout';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useLocale, useTranslations } from '@/i18n/provider';
import { clientRequestId } from '@/lib/client-id';
import { formatMoney } from '@/lib/money';

interface CheckoutFieldConfig {
  fieldKey: string;
  mode: 'REQUIRED' | 'OPTIONAL' | 'HIDDEN';
}

/**
 * Landing page order form.
 *
 * A direct COD order without a cart — the shortest path from a landing page to
 * a confirmed order, which is the whole point of the format. It posts through
 * the same checkout action as the storefront, so it inherits the same
 * validation, fraud protection, IP blocking and rate limiting.
 */
export function LandingOrderForm({
  storeSlug,
  productId,
  landingPageId,
  currency,
  price,
  fields,
  locale,
}: {
  storeSlug: string;
  productId: string;
  landingPageId: string;
  currency: string;
  price: number;
  fields: CheckoutFieldConfig[];
  locale: string;
}) {
  const t = useTranslations('storefront');
  const tCheckout = useTranslations('settings.checkout.fields');
  const tApp = useTranslations('app');
  const currentLocale = useLocale();
  const router = useRouter();

  const [sessionId] = useState(() => clientRequestId());
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [shippingAmount, setShippingAmount] = useState<number | null>(null);

  const action = useServerAction(submitCheckoutAction);

  const mode = (key: string) => fields.find((field) => field.fieldKey === key)?.mode ?? 'HIDDEN';
  const visible = (key: string) => mode(key) !== 'HIDDEN';
  const required = (key: string) => mode(key) === 'REQUIRED';

  useEffect(() => {
    void trackEventAction({
      storeSlug,
      name: 'checkout_started',
      productId,
      sessionId,
      value: price,
    });
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state && !city) return;

    const timer = setTimeout(async () => {
      const result = await quoteShippingAction(storeSlug, { state, city });
      if (result.ok) setShippingAmount(result.data[0]?.price ?? null);
    }, 400);

    return () => clearTimeout(timer);
  }, [state, city, storeSlug]);

  const subtotal = price * quantity;
  const total = subtotal + (shippingAmount ?? 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await action.run({
      storeSlug,
      items: [{ productId, quantity }],
      customerName,
      customerPhone,
      state,
      city,
      address,
      notes,
      sessionId,
      landingPageId,
    });

    if (!result) return;

    router.replace(
      `/${locale}/${storeSlug}/order-success?order=${encodeURIComponent(result.orderNumber)}`,
    );
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-4"
    >
      <FormError message={action.error} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">{t('quantity')}</span>
        <div className="flex items-center rounded-[var(--radius)] border border-border">
          <button
            type="button"
            aria-label="-"
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="flex size-11 items-center justify-center text-foreground disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="w-10 text-center text-sm tabular-nums text-foreground">{quantity}</span>
          <button
            type="button"
            aria-label="+"
            onClick={() => setQuantity((current) => Math.min(99, current + 1))}
            className="flex size-11 items-center justify-center text-foreground"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {visible('customerName') ? (
          <Field
            label={tCheckout('customerName')}
            required={required('customerName')}
            error={action.fieldError('customerName')}
          >
            <Input
              value={customerName}
              autoComplete="name"
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </Field>
        ) : null}

        <Field label={tCheckout('phone')} required error={action.fieldError('phone')}>
          <Input
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={customerPhone}
            autoComplete="tel"
            placeholder="091 234 5678"
            onChange={(event) => setCustomerPhone(event.target.value)}
          />
        </Field>

        {visible('state') ? (
          <Field
            label={tCheckout('state')}
            required={required('state')}
            error={action.fieldError('state')}
          >
            <Input value={state} onChange={(event) => setState(event.target.value)} />
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
              autoComplete="address-level2"
              onChange={(event) => setCity(event.target.value)}
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
              rows={2}
              autoComplete="street-address"
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
        ) : null}

        {visible('notes') ? (
          <Field label={tCheckout('notes')} optionalLabel={tApp('optional')}>
            <Textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        ) : null}
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{tApp('subtotal')}</dt>
          <dd className="tabular-nums text-foreground">
            {formatMoney(subtotal, currency, currentLocale)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{tApp('shipping')}</dt>
          <dd className="tabular-nums text-foreground">
            {shippingAmount === null
              ? t('shippingCalculated')
              : formatMoney(shippingAmount, currency, currentLocale)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <dt className="font-medium text-foreground">{tApp('total')}</dt>
          <dd className="text-lg font-bold tabular-nums text-foreground">
            {formatMoney(total, currency, currentLocale)}
          </dd>
        </div>
      </dl>

      <Button
        type="submit"
        variant="primary"
        size="touch"
        block
        className="mt-4"
        loading={action.submitting}
      >
        {action.submitting ? t('placingOrder') : t('placeOrder')}
      </Button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
        {t('codNotice')}
      </p>
    </form>
  );
}
