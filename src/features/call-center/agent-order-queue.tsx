'use client';

import Link from 'next/link';
import { ListChecks, MessageCircle, Phone } from 'lucide-react';

import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/data-display/pagination';
import { OrderStatusBadge } from '@/features/orders/status-badge';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { useTranslations } from '@/i18n/provider';
import { RelativeTime } from '@/features/shared/relative-time';
import { formatMoney } from '@/lib/money';
import { formatPhone, isolateLtr, toTelLink, toWhatsAppLink } from '@/lib/phone';
import { ORDER_STATUSES, type OrderStatus } from '@/features/orders/state-machine';
import { cn } from '@/lib/cn';

interface QueueOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  state: string;
  city: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

/**
 * Agent order queue.
 *
 * Card-first and touch-first: an agent works this screen on a phone while on a
 * call, so calling and messaging the customer are one tap from the list, not
 * buried inside the order.
 */
export function AgentOrderQueue({
  result,
  locale,
  currency,
  country,
}: {
  result: {
    items: QueueOrder[];
    total: number;
    page: number;
    perPage: number;
    pageCount: number;
  };
  locale: string;
  currency: string;
  country: string;
}) {
  const t = useTranslations('callCenter.portal');
  const tApp = useTranslations('app');
  const tOrders = useTranslations('orders');
  const { get, setFilters } = useUrlFilters();

  const activeStatus = get('status');

  return (
    <div className="space-y-3">
      <div className="hide-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3">
        <StatusChip
          label={tApp('all')}
          active={!activeStatus}
          onClick={() => setFilters({ status: null })}
        />
        {ORDER_STATUSES.slice(0, 6).map((status) => (
          <StatusChip
            key={status}
            label={tOrders(`status.${status}`)}
            active={activeStatus === status}
            onClick={() => setFilters({ status })}
          />
        ))}
      </div>

      {result.items.length === 0 ? (
        <Card>
          <EmptyState icon={<ListChecks />} title={t('empty')} description={t('emptyHint')} />
        </Card>
      ) : (
        <ul className="space-y-2">
          {result.items.map((order) => (
            <li key={order.id}>
              <Card>
                <CardBody className="space-y-3 p-3">
                  <Link href={`/${locale}/agent/orders/${order.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-muted-foreground">
                          {isolateLtr(order.orderNumber)}
                        </span>
                        <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                          {order.customerName}
                        </p>
                        <p className="truncate text-xs text-subtle-foreground">
                          {[order.state, order.city].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {formatMoney(order.total, currency, locale)}
                        </p>
                        <p className="mt-0.5 text-2xs text-subtle-foreground">
                          <RelativeTime value={order.createdAt} locale={locale} />
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <OrderStatusBadge status={order.status} size="md" />
                    </div>
                  </Link>

                  {/* One-tap contact — the agent's most common action. */}
                  <div className="flex gap-2">
                    <Button asChild variant="secondary" size="touch" className="flex-1">
                      <a href={toTelLink(order.customerPhone, country)}>
                        <Phone aria-hidden />
                        {t('callCustomer')}
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="touch" className="flex-1">
                      <a
                        href={toWhatsAppLink(order.customerPhone, country)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle aria-hidden />
                        {t('whatsapp')}
                      </a>
                    </Button>
                  </div>

                  <p className="text-center font-mono text-2xs text-subtle-foreground" dir="ltr">
                    {formatPhone(order.customerPhone, country)}
                  </p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          perPage={result.perPage}
          onPageChange={(page) => setFilters({ page }, { keepPage: true })}
        />
      </Card>
    </div>
  );
}

function StatusChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors duration-fast',
        active
          ? 'border-primary bg-[var(--primary-soft)] font-medium text-primary'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
