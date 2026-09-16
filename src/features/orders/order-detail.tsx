'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Printer,
  Save,
  ShieldAlert,
  Truck,
  User,
} from 'lucide-react';
import { useState } from 'react';

import { changeOrderStatusAction, updateOrderAction } from '@/app/actions/orders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, NativeSelect, Textarea } from '@/components/ui/field';
import { PageHeader } from '@/components/layout/page-header';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatDateTime } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { formatPhone, isolateLtr, toTelLink, toWhatsAppLink } from '@/lib/phone';

import { OrderStatusChanger } from './status-changer';
import { OrderTimeline } from './order-timeline';
import { OrderStatusBadge, PaymentStatusBadge, SourceBadge } from './status-badge';
import type { OrderStatus } from './state-machine';

/** Serialised OrderDetail — dates arrive as ISO strings through the boundary. */
export interface SerialisedOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  shippingStatus: string;
  source: string;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  total: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  state: string;
  city: string;
  address: string;
  notes: string | null;
  internalNotes: string | null;
  tags: string[];
  trackingNumber: string | null;
  riskFlagged: boolean;
  riskReason: string | null;
  version: number;
  createdAt: string;
  assignedAgentId: string | null;
  shippingProviderId: string | null;
  customFields: Record<string, unknown> | null;
  customer: { id: string; name: string; ordersCount: number; totalSpent: number } | null;
  assignedAgent: { id: string; fullName: string } | null;
  shippingProvider: { id: string; name: string } | null;
  shippingMethod: { id: string; name: string } | null;
  items: Array<{
    id: string;
    nameSnapshot: string;
    variantSnapshot: string | null;
    skuSnapshot: string | null;
    imageSnapshot: string | null;
    unitPrice: number;
    quantity: number;
    total: number;
    productId: string | null;
  }>;
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorName: string | null;
    reason: string | null;
    createdAt: string;
  }>;
}

/**
 * Order detail.
 *
 * Everything an operator needs on one screen, in the order they need it:
 * status and actions first, then the customer and how to reach them, then the
 * items, then the history. On a phone this is one column with the primary
 * action sticky at the bottom.
 */
export function OrderDetailView({
  order,
  locale,
  currency,
  timezone,
  country,
  backHref,
  backLabel,
  agents,
  providers,
  canChangeStatus,
  canEdit,
  canAssign,
  canPrintSlip,
}: {
  order: SerialisedOrder;
  locale: string;
  currency: string;
  timezone: string;
  country: string;
  backHref: string;
  backLabel: string;
  agents: Array<{ id: string; name: string }>;
  providers: Array<{ id: string; name: string }>;
  canChangeStatus: boolean;
  canEdit: boolean;
  canAssign: boolean;
  canPrintSlip: boolean;
}) {
  const t = useTranslations('orders');
  const tApp = useTranslations('app');
  const tPortal = useTranslations('callCenter.portal');
  const router = useRouter();
  const { toast } = useToast();

  const [internalNotes, setInternalNotes] = useState(order.internalNotes ?? '');
  const [agentId, setAgentId] = useState(order.assignedAgentId ?? '');
  const [providerId, setProviderId] = useState(order.shippingProviderId ?? '');

  const statusAction = useServerAction(changeOrderStatusAction);
  const updateAction = useServerAction(updateOrderAction);

  const changeStatus = async (toStatus: OrderStatus, reason: string | null) => {
    const result = await statusAction.run({
      orderId: order.id,
      toStatus,
      reason,
      expectedVersion: order.version,
    });

    if (!result) {
      if (statusAction.error) toast({ title: statusAction.error, tone: 'error' });
      return false;
    }

    // An idempotent no-op is reported honestly rather than as a change.
    toast({
      title: result.alreadyApplied ? tApp('refresh') : t('statusChanged'),
      tone: result.alreadyApplied ? 'info' : 'success',
    });
    router.refresh();
    return true;
  };

  const saveDetails = async () => {
    const result = await updateAction.run({
      orderId: order.id,
      internalNotes: internalNotes || null,
      assignedAgentId: agentId || null,
      shippingProviderId: providerId || null,
      expectedVersion: order.version,
    });

    if (result === null) {
      if (updateAction.error) toast({ title: updateAction.error, tone: 'error' });
      return;
    }
    toast({ title: tApp('save'), tone: 'success' });
    router.refresh();
  };

  return (
    <div>
      <PageHeader
        title={<span className="font-mono">{isolateLtr(order.orderNumber)}</span>}
        description={formatDateTime(order.createdAt, locale, timezone)}
        backHref={backHref}
        backLabel={backLabel}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canPrintSlip ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`${backHref}/${order.id}/slip`} target="_blank">
                  <Printer aria-hidden />
                  {t('printSlip')}
                </Link>
              </Button>
            ) : null}
            {canChangeStatus ? (
              <OrderStatusChanger
                current={order.status}
                onChange={changeStatus}
                loading={statusAction.submitting}
              />
            ) : null}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} size="md" />
          <PaymentStatusBadge status={order.paymentStatus} />
          <SourceBadge source={order.source} />
          <Badge tone="outline">{t(`paymentMethod.${order.paymentMethod}`)}</Badge>
          {order.riskFlagged ? (
            <Badge tone="warning" icon={<ShieldAlert className="size-3" />}>
              {t('riskFlagged')}
            </Badge>
          ) : null}
        </div>
      </PageHeader>

      <FormError message={statusAction.error ?? updateAction.error} />

      {order.riskFlagged ? (
        <div className="mb-3 rounded-[var(--radius)] border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-xs text-warning">
          {order.riskReason ?? t('riskFlaggedHint')}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {/* Items */}
          <Card>
            <CardHeader title={t('items')} />
            <CardBody className="p-0">
              <ul className="divide-y divide-border">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    {item.imageSnapshot ? (
                      // eslint-disable-next-line @next/next/no-img-element -- arbitrary upload paths
                      <img
                        src={item.imageSnapshot}
                        alt=""
                        className="size-11 shrink-0 rounded-[var(--radius-sm)] object-cover"
                      />
                    ) : (
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-3 text-subtle-foreground">
                        <Package className="size-4" aria-hidden />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      {/* The snapshot is what renders: the order must read
                          correctly even if the product was later renamed. */}
                      <p className="text-[13px] font-medium text-foreground">{item.nameSnapshot}</p>
                      {item.variantSnapshot ? (
                        <p className="text-xs text-muted-foreground">{item.variantSnapshot}</p>
                      ) : null}
                      {item.skuSnapshot ? (
                        <p className="font-mono text-2xs text-subtle-foreground">{item.skuSnapshot}</p>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-end">
                      <p className="text-[13px] tabular-nums text-foreground">
                        {formatMoney(item.total, currency, locale)}
                      </p>
                      <p className="text-2xs tabular-nums text-subtle-foreground">
                        {formatMoney(item.unitPrice, currency, locale)} × {item.quantity}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <dl className="space-y-1.5 border-t border-border px-4 py-3 text-[13px]">
                <Row label={tApp('subtotal')} value={formatMoney(order.subtotal, currency, locale)} />
                {order.discountAmount > 0 ? (
                  <Row
                    label={tApp('discount')}
                    value={`−${formatMoney(order.discountAmount, currency, locale)}`}
                    tone="success"
                  />
                ) : null}
                <Row label={tApp('shipping')} value={formatMoney(order.shippingAmount, currency, locale)} />
                <Row
                  label={tApp('total')}
                  value={formatMoney(order.total, currency, locale)}
                  emphasis
                />
              </dl>
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title={t('timeline')} />
            <CardBody>
              <OrderTimeline history={order.history} locale={locale} timezone={timezone} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3">
          {/* Customer */}
          <Card>
            <CardHeader title={t('customer')} />
            <CardBody className="space-y-3 text-[13px]">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-foreground">{order.customerName}</p>
                  {order.customer ? (
                    <p className="text-xs text-subtle-foreground">
                      {t('itemsCount', { count: order.customer.ordersCount })} ·{' '}
                      {formatMoney(order.customer.totalSpent, currency, locale)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />
                <a
                  href={toTelLink(order.customerPhone, country)}
                  className="font-mono text-foreground hover:text-primary"
                  dir="ltr"
                >
                  {formatPhone(order.customerPhone, country)}
                </a>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />
                <p className="min-w-0 text-foreground">
                  {[order.state, order.city, order.address].filter(Boolean).join('، ') || '—'}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a href={toTelLink(order.customerPhone, country)}>
                    <Phone aria-hidden />
                    {tPortal('callCustomer')}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a
                    href={toWhatsAppLink(order.customerPhone, country)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle aria-hidden />
                    WhatsApp
                  </a>
                </Button>
              </div>

              {order.notes ? (
                <div className="rounded-[var(--radius)] bg-surface-2 p-2.5">
                  <p className="text-2xs font-medium text-subtle-foreground">{t('customerNotes')}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{order.notes}</p>
                </div>
              ) : null}

              {order.customFields && Object.keys(order.customFields).length > 0 ? (
                <dl className="space-y-1 rounded-[var(--radius)] bg-surface-2 p-2.5 text-xs">
                  {Object.entries(order.customFields).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <dt className="text-subtle-foreground">{key}</dt>
                      <dd className="text-foreground">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </CardBody>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader title={t('provider')} />
            <CardBody className="space-y-3">
              {canAssign && agents.length > 0 ? (
                <Field label={t('assignAgent')}>
                  <NativeSelect value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                    <option value="">{t('unassigned')}</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : order.assignedAgent ? (
                <p className="text-[13px] text-foreground">{order.assignedAgent.fullName}</p>
              ) : null}

              {canEdit && providers.length > 0 ? (
                <Field label={t('assignProvider')}>
                  <NativeSelect
                    value={providerId}
                    onChange={(event) => setProviderId(event.target.value)}
                  >
                    <option value="">{t('unassigned')}</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : order.shippingProvider ? (
                <p className="flex items-center gap-2 text-[13px] text-foreground">
                  <Truck className="size-4 text-subtle-foreground" aria-hidden />
                  {order.shippingProvider.name}
                </p>
              ) : null}

              {order.trackingNumber ? (
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {order.trackingNumber}
                </p>
              ) : null}

              {canEdit ? (
                <Field label={t('internalNotes')} hint={t('internalNotesHint')}>
                  <Textarea
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
                    rows={3}
                  />
                </Field>
              ) : null}

              {canEdit ? (
                <Button
                  variant="primary"
                  size="sm"
                  block
                  loading={updateAction.submitting}
                  onClick={saveDetails}
                >
                  <Save aria-hidden />
                  {tApp('saveChanges')}
                </Button>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'success';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={emphasis ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</dt>
      <dd
        className={
          emphasis
            ? 'text-[15px] font-semibold tabular-nums text-foreground'
            : tone === 'success'
              ? 'tabular-nums text-success'
              : 'tabular-nums text-foreground'
        }
      >
        {value}
      </dd>
    </div>
  );
}
