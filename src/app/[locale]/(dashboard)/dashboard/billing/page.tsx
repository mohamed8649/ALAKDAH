import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { BillingView } from '@/features/billing/billing-view';
import { getTranslations } from '@/i18n/server';
import { hasPermission, requirePermission } from '@/server/policies/context';
import {
  getAllUsage,
  getSubscription,
  listAddOns,
  listPlans,
} from '@/server/services/billing-service';

export const metadata: Metadata = { title: 'الاشتراك والفوترة' };
export const dynamic = 'force-dynamic';

export default async function BillingPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('billing.view');
  const t = getTranslations(params.locale, 'billing');

  const [plans, subscription, usage, addOns] = await Promise.all([
    listPlans(),
    getSubscription(context.storeId),
    getAllUsage(context.storeId),
    listAddOns(),
  ]);

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <BillingView
        plans={plans.map((plan) => ({
          key: plan.key,
          nameAr: plan.nameAr,
          descriptionAr: plan.descriptionAr,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          currency: plan.currency,
          isPayg: plan.isPayg,
          features: plan.features.filter((f) => f.enabled).map((f) => f.featureKey),
          limits: Object.fromEntries(plan.limits.map((l) => [l.limitKey, l.value])),
        }))}
        currentPlanKey={subscription?.planKey ?? null}
        status={subscription?.status ?? 'ACTIVE'}
        interval={subscription?.interval ?? 'MONTHLY'}
        periodEnd={subscription?.currentPeriodEnd.toISOString() ?? null}
        usage={usage}
        addOns={addOns.map((addOn) => ({
          key: addOn.key,
          nameAr: addOn.nameAr,
          limitKey: addOn.limitKey,
          quantity: addOn.quantity,
          price: addOn.price,
          currency: addOn.currency,
        }))}
        locale={params.locale}
        canManage={hasPermission(context, 'billing.manage')}
      />
    </div>
  );
}
