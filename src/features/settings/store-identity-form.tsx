'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';

import { updateIdentityAction } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { ImageField } from '@/features/settings/image-field';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';

export interface StoreIdentityValues {
  name: string;
  description: string;
  phone: string;
  email: string;
  logoUrl: string;
  faviconUrl: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  telegram: string;
  whatsapp: string;
  defaultLocale: 'ar' | 'en';
  currency: string;
  timezone: string;
}

const TIMEZONES = [
  'Africa/Tripoli',
  'Africa/Tunis',
  'Africa/Cairo',
  'Africa/Algiers',
  'Africa/Casablanca',
  'UTC',
];

/**
 * Store identity.
 *
 * Currency and timezone sit here because they change how every price and date
 * in the product is rendered — this is the one place those two decisions live.
 */
export function StoreIdentityForm({
  initial,
  storeSlug,
  canManage,
}: {
  initial: StoreIdentityValues;
  storeSlug: string;
  canManage: boolean;
}) {
  const t = useTranslations('settings');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [values, setValues] = useState(initial);
  const action = useServerAction(updateIdentityAction);

  const set = <K extends keyof StoreIdentityValues>(key: K, value: StoreIdentityValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await action.run(values);
    if (result === null) return;
    toast({ title: t('saved'), tone: 'success' });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <FormError message={action.error} />

      <Card>
        <CardHeader title={t('sections.identity')} />
        <CardBody className="space-y-4">
          <Field label={t('identity.name')} required error={action.fieldError('name')}>
            <Input
              value={values.name}
              disabled={!canManage}
              onChange={(event) => set('name', event.target.value)}
            />
          </Field>

          <Field label={t('identity.description')} optionalLabel={tApp('optional')}>
            <Textarea
              value={values.description}
              disabled={!canManage}
              rows={3}
              onChange={(event) => set('description', event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <ImageField
              label={t('identity.logo')}
              value={values.logoUrl}
              onChange={(url) => set('logoUrl', url)}
              disabled={!canManage}
              folder="branding"
            />
            <ImageField
              label={t('identity.favicon')}
              value={values.faviconUrl}
              onChange={(url) => set('faviconUrl', url)}
              disabled={!canManage}
              folder="branding"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('identity.phone')} optionalLabel={tApp('optional')}>
              <Input
                type="tel"
                dir="ltr"
                value={values.phone}
                disabled={!canManage}
                onChange={(event) => set('phone', event.target.value)}
              />
            </Field>

            <Field
              label={t('identity.email')}
              optionalLabel={tApp('optional')}
              error={action.fieldError('email')}
            >
              <Input
                type="email"
                dir="ltr"
                value={values.email}
                disabled={!canManage}
                onChange={(event) => set('email', event.target.value)}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('sections.localization')} />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label={tApp('language')}>
            <NativeSelect
              value={values.defaultLocale}
              disabled={!canManage}
              onChange={(event) => set('defaultLocale', event.target.value as 'ar' | 'en')}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </NativeSelect>
          </Field>

          <Field label={tApp('currency')}>
            <NativeSelect
              value={values.currency}
              disabled={!canManage}
              onChange={(event) => set('currency', event.target.value)}
            >
              <option value="LYD">LYD — دينار ليبي</option>
              <option value="TND">TND — دينار تونسي</option>
              <option value="EGP">EGP — جنيه مصري</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </NativeSelect>
          </Field>

          <Field label={tApp('timezone')}>
            <NativeSelect
              value={values.timezone}
              disabled={!canManage}
              onChange={(event) => set('timezone', event.target.value)}
            >
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('sections.social')} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {(['instagram', 'facebook', 'tiktok', 'telegram'] as const).map((key) => (
            <Field key={key} label={key} optionalLabel={tApp('optional')}>
              <Input
                dir="ltr"
                placeholder="https://"
                value={values[key]}
                disabled={!canManage}
                onChange={(event) => set(key, event.target.value)}
              />
            </Field>
          ))}

          <Field label="WhatsApp" optionalLabel={tApp('optional')}>
            <Input
              dir="ltr"
              type="tel"
              value={values.whatsapp}
              disabled={!canManage}
              onChange={(event) => set('whatsapp', event.target.value)}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('sections.domains')} />
        <CardBody>
          <Field label={tApp('name')} hint={`/${storeSlug}`}>
            <Input value={storeSlug} disabled dir="ltr" />
          </Field>
        </CardBody>
      </Card>

      {canManage ? (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={action.submitting}>
            <Save aria-hidden />
            {tApp('saveChanges')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
