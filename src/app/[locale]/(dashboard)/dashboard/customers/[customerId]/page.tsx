import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Phone, ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data-display/stat-card';
import { OrderStatusBadge } from '@/features/orders/status-badge';
import type { OrderStatus } from '@/features/orders/state-machine';
import { getTranslations } from '@/i18n/server';
import { AppError } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/datetime';
import { formatMoney, formatNumber } from '@/lib/money';
import { formatPhone, toTelLink } from '@/lib/phone';
import { requirePermission } from '@/server/policies/context';
import { getCustomer } from '@/server/services/customer-service';

export const metadata: Metadata = { title: 'ملف العميل' };
export const dynamic = 'force-dynamic';

export default async function CustomerPage({
  params,
}: {
  params: { locale: string; customerId: string };
}) {
  const context = await requirePermission('customers.view');
  const t = getTranslations(params.locale, 'customers');
  const tApp = getTranslations(params.locale, 'app');

  let customer;
  try {
    customer = await getCustomer(context, params.customerId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={formatPhone(customer.phone, context.country)}
        backHref={`/${params.locale}/dashboard/customers`}
        backLabel={t('title')}
        actions={
          customer.isBlocked ? <Badge tone="danger" size="md">{t('blocked')}</Badge> : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('ordersCount')}
          value={formatNumber(customer.ordersCount, params.locale)}
          icon={<ShoppingBag />}
          tone="primary"
        />
        <StatCard
          label={t('totalSpent')}
          value={formatMoney(customer.totalSpent, context.currency, params.locale)}
          tone="success"
        />
        <StatCard
          label={t('lastOrder')}
          value={customer.lastOrderAt ? formatRelative(customer.lastOrderAt, params.locale) : null}
        />
        <StatCard
          label={tApp('createdAt')}
          value={formatDate(customer.createdAt, params.locale, context.timezone)}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title={t('previousOrders')} />
            {customer.orders.length === 0 ? (
              <EmptyState compact icon={<ShoppingBag />} title={t('noOrders')} />
            ) : (
              <CardBody className="p-0">
                <ul className="divide-y divide-border">
                  {customer.orders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/${params.locale}/dashboard/orders/${order.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-2"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-xs text-muted-foreground">
                            {order.orderNumber}
                          </span>
                          <div className="mt-1">
                            <OrderStatusBadge status={order.status as OrderStatus} />
                          </div>
                        </div>
                        <div className="shrink-0 text-end">
                          <p className="text-[13px] font-medium tabular-nums text-foreground">
                            {formatMoney(order.total, context.currency, params.locale)}
                          </p>
                          <p className="text-2xs text-subtle-foreground">
                            {formatDate(order.createdAt, params.locale, context.timezone)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader title={tApp('details')} />
            <CardBody className="space-y-3 text-[13px]">
              <a
                href={toTelLink(customer.phone, context.country)}
                className="flex items-center gap-2 font-mono text-foreground hover:text-primary"
                dir="ltr"
              >
                <Phone className="size-4 text-subtle-foreground" aria-hidden />
                {formatPhone(customer.phone, context.country)}
              </a>

              {customer.email ? (
                <p className="text-muted-foreground" dir="ltr">
                  {customer.email}
                </p>
              ) : null}

              {customer.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {customer.tags.map((tag) => (
                    <Badge key={tag} tone="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {customer.notes ? (
                <p className="whitespace-pre-wrap rounded-[var(--radius)] bg-surface-2 p-2.5 text-xs text-muted-foreground">
                  {customer.notes}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('addresses')} />
            {customer.addresses.length === 0 ? (
              <EmptyState compact icon={<MapPin />} title={t('noAddresses')} />
            ) : (
              <CardBody className="space-y-2 text-[13px]">
                {customer.addresses.map((address) => (
                  <div key={address.id} className="rounded-[var(--radius)] bg-surface-2 p-2.5">
                    <p className="text-foreground">
                      {[address.state, address.city, address.address].filter(Boolean).join('، ')}
                    </p>
                    {address.isDefault ? (
                      <Badge tone="primary" className="mt-1.5">
                        {t('defaultAddress')}
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </CardBody>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
