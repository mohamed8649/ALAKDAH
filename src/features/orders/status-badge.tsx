'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/i18n/provider';

import { statusTone, type OrderStatus } from './state-machine';

/**
 * Order status chip.
 *
 * Colour is a secondary cue; the label is always present. Colour alone would
 * exclude anyone who cannot distinguish the two red statuses.
 */
export function OrderStatusBadge({
  status,
  size = 'sm',
}: {
  status: OrderStatus;
  size?: 'sm' | 'md';
}) {
  const t = useTranslations('orders.status');
  return (
    <Badge tone={statusTone(status)} size={size} dot>
      {t(status)}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const t = useTranslations('orders.payment');
  const tone = status === 'PAID' ? 'success' : status === 'FAILED' ? 'danger' : 'neutral';
  return (
    <Badge tone={tone} size="sm">
      {t(status)}
    </Badge>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const t = useTranslations('orders.sources');
  return (
    <Badge tone="outline" size="sm">
      {t(source)}
    </Badge>
  );
}
