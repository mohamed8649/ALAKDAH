'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { OrderStatusBadge } from '@/features/orders/status-badge';
import type { OrderListItem } from '@/server/services/order-service';
import { useTranslations } from '@/i18n/provider';
import { RelativeTime } from '@/features/shared/relative-time';
import { formatMoney } from '@/lib/money';
import { formatPhone, isolateLtr } from '@/lib/phone';

export function RecentOrders({
  orders,
  locale,
  currency,
  timezone,
}: {
  orders: OrderListItem[];
  locale: string;
  currency: string;
  timezone: string;
}) {
  const t = useTranslations('dashboard');
  const tOrders = useTranslations('orders');
  const tApp = useTranslations('app');

  return (
    <Card>
      <CardHeader
        title={t('recentOrders')}
        action={
          orders.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${locale}/dashboard/orders`}>{tApp('viewAll')}</Link>
            </Button>
          ) : null
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          compact
          icon={<ShoppingBag />}
          title={tOrders('empty')}
          description={tOrders('emptyDescription')}
        />
      ) : (
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/${locale}/dashboard/orders/${order.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {isolateLtr(order.orderNumber)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-foreground">{order.customerName}</p>
                    <p className="truncate text-xs text-subtle-foreground">
                      {isolateLtr(formatPhone(order.customerPhone))}
                      {order.city ? ` · ${order.city}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-end">
                    <p className="text-[13px] font-medium tabular-nums text-foreground">
                      {formatMoney(order.total, currency, locale)}
                    </p>
                    <p className="mt-0.5 text-2xs text-subtle-foreground">
                      <RelativeTime value={order.createdAt} locale={locale} />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      )}
    </Card>
  );
}
