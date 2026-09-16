'use client';

import { Package, Phone, Search } from 'lucide-react';
import { useState } from 'react';

import { trackOrderAction } from '@/app/actions/checkout';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError } from '@/features/shared/form-error';
import { OrderStatusBadge } from '@/features/orders/status-badge';
import type { OrderStatus } from '@/features/orders/state-machine';
import { useServerAction } from '@/hooks/use-server-action';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatDateTime } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { toTelLink } from '@/lib/phone';

interface TrackedOrder {
  orderNumber: string;
  status: string;
  shippingStatus: string;
  total: number;
  currency: string;
  createdAt: string;
  city: string;
  items: Array<{ name: string; variant: string | null; quantity: number }>;
  timeline: Array<{ status: string; at: string }>;
}

/**
 * Public order tracking.
 *
 * Shows a status, a timeline and what was ordered — never the address, the
 * internal notes, the assigned agent or the carrier. A failed lookup says only
 * "not found", so the form cannot confirm whether an order number exists.
 */
export function OrderTrackingForm({
  storeSlug,
  method,
  currency,
  timezone,
  defaultOrderNumber,
  contactPhone,
  country,
}: {
  storeSlug: string;
  method: string;
  currency: string;
  timezone: string;
  defaultOrderNumber: string;
  contactPhone: string | null;
  country: string;
}) {
  const t = useTranslations('storefront.tracking');
  const tStatus = useTranslations('orders.status');
  const tApp = useTranslations('app');
  const locale = useLocale();

  const [orderNumber, setOrderNumber] = useState(defaultOrderNumber);
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [notFound, setNotFound] = useState(false);

  const action = useServerAction(trackOrderAction);

  const needsOrderNumber = method !== 'PHONE_ONLY';
  const needsPhone = method !== 'ORDER_NUMBER_ONLY';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotFound(false);
    setOrder(null);

    const result = await action.run({ storeSlug, orderNumber, phone });

    if (!result) {
      setNotFound(true);
      return;
    }
    setOrder(result as TrackedOrder);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">{t('subtitle')}</p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {needsOrderNumber ? (
          <Field label={t('orderNumber')} required error={action.fieldError('orderNumber')}>
            <Input
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value.toUpperCase())}
              dir="ltr"
              className="font-mono"
              placeholder="A7K3M2"
            />
          </Field>
        ) : null}

        {needsPhone ? (
          <Field label={t('phone')} required error={action.fieldError('phone')}>
            <Input
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="091 234 5678"
            />
          </Field>
        ) : null}

        <Button type="submit" variant="primary" size="touch" block loading={action.submitting}>
          <Search aria-hidden />
          {t('submit')}
        </Button>
      </form>

      {notFound ? (
        <div className="mt-4">
          <FormError message={t('notFound')} />
          {contactPhone ? (
            <Button asChild variant="outline" size="touch" block className="mt-3">
              <a href={toTelLink(contactPhone, country)}>
                <Phone aria-hidden />
                {t('contactStore')}
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {order ? (
        <section className="mt-6 rounded-[var(--radius-lg)] border border-border bg-surface-1 p-4">
          <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
            <div>
              <p className="font-mono text-sm font-semibold text-foreground" dir="ltr">
                {t('yourOrder', { number: order.orderNumber })}
              </p>
              <p className="mt-0.5 text-xs text-subtle-foreground">
                {t('placedOn', { date: formatDateTime(order.createdAt, locale, timezone) })}
              </p>
            </div>
            <OrderStatusBadge status={order.status as OrderStatus} size="md" />
          </header>

          <ul className="mt-3 space-y-2">
            {order.items.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-[13px]">
                <Package className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
                <span className="min-w-0 flex-1 text-foreground">
                  {item.name}
                  {item.variant ? (
                    <span className="text-muted-foreground"> — {item.variant}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">×{item.quantity}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-[13px] text-muted-foreground">{tApp('total')}</span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {formatMoney(order.total, currency, locale)}
            </span>
          </div>

          {order.timeline.length > 0 ? (
            <ol className="mt-4 space-y-2 border-t border-border pt-3">
              {order.timeline.map((entry, index) => (
                <li key={index} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground">{tStatus(entry.status)}</span>
                  <span className="shrink-0 text-subtle-foreground">
                    {formatDateTime(entry.at, locale, timezone)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          {contactPhone ? (
            <Button asChild variant="outline" size="touch" block className="mt-4">
              <a href={toTelLink(contactPhone, country)}>
                <Phone aria-hidden />
                {t('contactStore')}
              </a>
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
