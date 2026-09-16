'use client';

import Link from 'next/link';
import { Phone, ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';

import { dismissAbandonedAction } from '@/app/actions/abandoned';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useServerAction } from '@/hooks/use-server-action';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatRelative } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { isolateLtr } from '@/lib/phone';

export interface AbandonedItem {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  state: string | null;
  city: string | null;
  itemCount: number;
  value: number;
  checkoutStep: string;
  status: 'OPEN' | 'RECOVERED' | 'DISMISSED';
  updatedAt: string;
}

const STATUS_TONES = {
  OPEN: 'warning',
  RECOVERED: 'success',
  DISMISSED: 'neutral',
} as const;

/**
 * Abandoned checkouts.
 *
 * Every row is someone who typed their phone number and stopped. The primary
 * action is therefore to call them, not to send an automated message — this is
 * a COD business and a phone call is what recovers the order.
 */
export function AbandonedList({
  items,
  currency,
  locale,
  canDismiss,
  trackingEnabled,
}: {
  items: AbandonedItem[];
  currency: string;
  locale: string;
  canDismiss: boolean;
  trackingEnabled: boolean;
}) {
  const t = useTranslations('abandoned');
  const tApp = useTranslations('app');
  const currentLocale = useLocale();
  const { toast } = useToast();

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dismiss = useServerAction(dismissAbandonedAction);

  const run = async (id: string) => {
    const result = await dismiss.run(id);
    if (result === null) return;
    // Hide it immediately rather than waiting for a refetch; the server row is
    // already DISMISSED either way.
    setDismissed((current) => new Set(current).add(id));
    toast({ title: t('markDismissed'), tone: 'success' });
  };

  const visible = items.filter((item) => !dismissed.has(item.id));

  if (visible.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={<ShoppingCart />}
            title={t('empty')}
            description={trackingEnabled ? t('privacyNote') : t('emptyDescription')}
            action={
              trackingEnabled ? undefined : (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/dashboard/apps`}>{tApp('settings')}</Link>
                </Button>
              )
            }
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-subtle-foreground">{t('privacyNote')}</p>

      <ul className="space-y-2">
        {visible.map((item) => (
          <li key={item.id}>
            <Card>
              <CardBody className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {item.customerName || t('unknownCustomer')}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {item.customerPhone ? (
                      <span dir="ltr" className="tabular-nums">
                        {isolateLtr(item.customerPhone)}
                      </span>
                    ) : null}
                    {item.city || item.state ? (
                      <span>{[item.city, item.state].filter(Boolean).join('، ')}</span>
                    ) : null}
                    <span>{formatRelative(new Date(item.updatedAt), currentLocale)}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_TONES[item.status]}>{t(`status.${item.status}`)}</Badge>
                  <Badge tone="outline">{t(`steps.${item.checkoutStep}`)}</Badge>
                  <span className="text-[13px] font-medium tabular-nums text-foreground">
                    {formatMoney(item.value, currency, currentLocale)}
                  </span>
                </div>

                <div className="flex gap-2">
                  {item.customerPhone ? (
                    <Button asChild variant="primary" size="sm">
                      <a href={`tel:${item.customerPhone}`}>
                        <Phone aria-hidden />
                        {t('call')}
                      </a>
                    </Button>
                  ) : null}

                  {canDismiss && item.status === 'OPEN' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={dismiss.submitting}
                      onClick={() => run(item.id)}
                    >
                      <X aria-hidden />
                      {t('markDismissed')}
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
