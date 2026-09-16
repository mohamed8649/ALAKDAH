'use client';

import { Check, Zap } from 'lucide-react';
import { useState } from 'react';

import { changePlanAction } from '@/app/actions/billing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useLocale, useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/datetime';
import { formatMoney, formatNumber } from '@/lib/money';
import type { UsageSnapshot } from '@/server/services/billing-service';

interface PlanCard {
  key: string;
  nameAr: string;
  descriptionAr: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  isPayg: boolean;
  features: string[];
  limits: Record<string, number>;
}

/**
 * Billing.
 *
 * Prices come from the database, never from a hard-coded string in this file.
 * Usage bars show consumption against the plan limit *plus* purchased add-ons,
 * which is the number that actually gates the merchant.
 */
export function BillingView({
  plans,
  currentPlanKey,
  status,
  interval: initialInterval,
  periodEnd,
  usage,
  addOns,
  locale,
  canManage,
}: {
  plans: PlanCard[];
  currentPlanKey: string | null;
  status: string;
  interval: string;
  periodEnd: string | null;
  usage: UsageSnapshot[];
  addOns: Array<{
    key: string;
    nameAr: string;
    limitKey: string;
    quantity: number;
    price: number;
    currency: string;
  }>;
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations('billing');
  const tApp = useTranslations('app');
  const currentLocale = useLocale();
  const { toast } = useToast();

  const [interval, setInterval] = useState(initialInterval);
  const [pending, setPending] = useState<string | null>(null);

  const currentPlan = plans.find((plan) => plan.key === currentPlanKey);

  const switchPlan = async (planKey: string) => {
    setPending(planKey);
    const result = await changePlanAction({ planKey, interval });
    setPending(null);

    toast({
      title: result.ok ? t('planChanged') : tApp('retry'),
      tone: result.ok ? 'success' : 'error',
    });
  };

  return (
    <div className="space-y-4">
      {/* Current plan */}
      <Card>
        <CardHeader title={t('currentPlan')} />
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">
              {currentPlan?.nameAr ?? '—'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={status === 'ACTIVE' ? 'success' : 'warning'} dot>
                {t(`status.${status}`)}
              </Badge>
              {periodEnd ? (
                <span className="text-xs text-subtle-foreground">
                  {t('renewsOn', { date: formatDate(periodEnd, currentLocale) })}
                </span>
              ) : null}
            </div>
          </div>

          <Tabs value={interval} onValueChange={setInterval}>
            <TabsList className="border-0">
              <TabsTrigger value="MONTHLY">{t('monthly')}</TabsTrigger>
              <TabsTrigger value="YEARLY">{t('yearly')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardBody>
      </Card>

      {/* Usage */}
      {usage.length > 0 ? (
        <Card>
          <CardHeader title={t('usage')} />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usage.map((snapshot) => {
              const percent = snapshot.unlimited
                ? 0
                : Math.min(100, Math.round((snapshot.used / Math.max(1, snapshot.limit)) * 100));
              const atLimit = !snapshot.unlimited && snapshot.used >= snapshot.limit;

              return (
                <div key={snapshot.limitKey}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">
                      {t(`limitKeys.${snapshot.limitKey}`)}
                    </span>
                    <span
                      className={cn('shrink-0 tabular-nums', atLimit ? 'text-danger' : 'text-foreground')}
                    >
                      {snapshot.unlimited
                        ? t('unlimited')
                        : t('used', {
                            used: formatNumber(snapshot.used, currentLocale),
                            limit: formatNumber(snapshot.limit, currentLocale),
                          })}
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-slow',
                        atLimit ? 'bg-danger' : percent > 80 ? 'bg-warning' : 'bg-primary',
                      )}
                      style={{ width: snapshot.unlimited ? '8%' : `${percent}%` }}
                    />
                  </div>

                  {atLimit ? (
                    <p className="mt-1 text-2xs text-danger">{t('limitReached')}</p>
                  ) : null}
                </div>
              );
            })}
          </CardBody>
        </Card>
      ) : null}

      {/* Plans */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t('choosePlan')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = plan.key === currentPlanKey;
            const price = interval === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <li key={plan.key}>
                <Card
                  className={cn(
                    'h-full',
                    isCurrent && 'border-primary ring-1 ring-[var(--primary)]',
                  )}
                >
                  <CardBody className="flex h-full flex-col gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">{plan.nameAr}</p>
                      {plan.descriptionAr ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {plan.descriptionAr}
                        </p>
                      ) : null}
                    </div>

                    <p className="text-xl font-bold tabular-nums text-foreground">
                      {price === 0 ? '—' : formatMoney(price, plan.currency, currentLocale)}
                      {price > 0 ? (
                        <span className="ms-1 text-xs font-normal text-subtle-foreground">
                          {interval === 'YEARLY' ? t('perYear') : t('perMonth')}
                        </span>
                      ) : null}
                    </p>

                    <ul className="space-y-1">
                      {plan.features.slice(0, 6).map((feature) => (
                        <li key={feature} className="flex items-center gap-1.5 text-xs">
                          <Check className="size-3 shrink-0 text-primary" aria-hidden />
                          <span className="truncate text-muted-foreground">
                            {t(`featureKeys.${feature}`)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-1">
                      {isCurrent ? (
                        <Badge tone="primary" size="md">
                          {t('currentPlan')}
                        </Badge>
                      ) : canManage ? (
                        <Button
                          variant="primary"
                          size="sm"
                          block
                          loading={pending === plan.key}
                          onClick={() => switchPlan(plan.key)}
                        >
                          {t('changePlan')}
                        </Button>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Add-ons */}
      {addOns.length > 0 ? (
        <Card>
          <CardHeader title={t('addOns')} />
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {addOns.map((addOn) => (
              <div
                key={addOn.key}
                className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-[13px] text-foreground">
                    <Zap className="size-3.5 shrink-0 text-warning" aria-hidden />
                    {addOn.nameAr}
                  </p>
                  <p className="text-2xs text-subtle-foreground">
                    {t(`limitKeys.${addOn.limitKey}`)}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
                  {formatMoney(addOn.price, addOn.currency, currentLocale)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
