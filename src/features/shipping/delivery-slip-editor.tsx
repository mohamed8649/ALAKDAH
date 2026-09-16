'use client';

import { Printer, Save } from 'lucide-react';
import { useState } from 'react';

import { saveDeliverySlipAction } from '@/app/actions/shipping';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { CheckboxField } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';

import { DeliverySlip, type SlipConfig, type SlipStore } from './delivery-slip';

const TOGGLE_KEYS = [
  'showCodAmount',
  'showCustomerName',
  'showPhone',
  'showAddress',
  'showProducts',
  'showQuantities',
  'showNotes',
  'showLogo',
  'showStoreInfo',
  'showOrderNumber',
  'showSignatureLines',
  'showBarcode',
] as const;

type ToggleKey = (typeof TOGGLE_KEYS)[number];

/**
 * Delivery slip builder.
 *
 * The preview is the real slip component with sample data, so what the merchant
 * toggles is exactly what prints. Printing uses the browser's own dialog, which
 * also covers "save as PDF" without shipping a PDF library.
 */
export function DeliverySlipEditor({
  config: initial,
  store,
  locale,
  currency,
  canManage,
}: {
  config: SlipConfig;
  store: SlipStore;
  locale: string;
  currency: string;
  canManage: boolean;
}) {
  const t = useTranslations('shipping.slip');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [config, setConfig] = useState<SlipConfig>(initial);
  const action = useServerAction(saveDeliverySlipAction);

  const set = <K extends keyof SlipConfig>(key: K, value: SlipConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const result = await action.run({ ...config, footerNote: config.footerNote ?? '' });
    if (result === null) return;
    toast({ title: tApp('save'), tone: 'success' });
  };

  const sampleOrder = {
    orderNumber: 'A7K3M2',
    customerName: 'أحمد المبروك',
    customerPhone: '218912345678',
    state: 'طرابلس',
    city: 'تاجوراء',
    address: 'شارع النصر، بجانب المسجد',
    notes: 'الاتصال قبل الوصول بنصف ساعة.',
    total: 235_000,
    currency,
    createdAt: new Date().toISOString(),
    items: [
      { name: 'سماعة بلوتوث لاسلكية', variant: 'أسود', quantity: 1 },
      { name: 'حقيبة ظهر مقاومة للماء', variant: null, quantity: 2 },
    ],
  };

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        <Card>
          <CardHeader title={t('title')} description={t('hint')} />
          <CardBody className="space-y-4">
            <FormError message={action.error} />

            <div className="space-y-2.5">
              <p className="text-[13px] font-medium text-foreground">{t('elements')}</p>
              {TOGGLE_KEYS.map((key) => (
                <CheckboxField
                  key={key}
                  checked={config[key] as boolean}
                  onCheckedChange={(checked) => set(key as ToggleKey, checked as never)}
                  label={t(`fields.${key}`)}
                  disabled={!canManage}
                />
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('paperSize')}>
                <NativeSelect
                  value={config.paperSize}
                  disabled={!canManage}
                  onChange={(event) => set('paperSize', event.target.value)}
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="A6">A6</option>
                </NativeSelect>
              </Field>

              <Field label={t('language')}>
                <NativeSelect
                  value={config.language}
                  disabled={!canManage}
                  onChange={(event) => set('language', event.target.value)}
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </NativeSelect>
              </Field>
            </div>

            <Field label={t('footerNote')} optionalLabel={tApp('optional')}>
              <Input
                value={config.footerNote ?? ''}
                disabled={!canManage}
                onChange={(event) => set('footerNote', event.target.value)}
              />
            </Field>

            {canManage ? (
              <Button variant="primary" block loading={action.submitting} onClick={save}>
                <Save aria-hidden />
                {tApp('saveChanges')}
              </Button>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <Card>
          <CardHeader
            title={tApp('preview')}
            description={t('previewNote')}
            action={
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer aria-hidden />
                {t('print')}
              </Button>
            }
          />
          <CardBody className="overflow-x-auto bg-surface-2">
            <div className="print-area origin-top scale-90 sm:scale-100">
              <DeliverySlip
                config={config}
                order={sampleOrder}
                store={store}
                timezone="Africa/Tripoli"
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
