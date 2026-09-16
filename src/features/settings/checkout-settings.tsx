'use client';

import { Lock, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  deleteCustomFieldAction,
  saveCustomFieldAction,
  updateCheckoutFieldsAction,
  updateCheckoutSettingsAction,
} from '@/app/actions/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { SwitchField, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { TagInput } from '@/features/shared/tag-input';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { normaliseFieldKey } from '@/lib/slug';

interface ResolvedField {
  fieldKey: string;
  mode: 'REQUIRED' | 'OPTIONAL' | 'HIDDEN';
  locked: boolean;
}

interface CustomFieldRow {
  id: string;
  label: string;
  fieldKey: string;
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RADIO' | 'CHECKBOX' | 'NUMBER';
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  options: string[];
  isActive: boolean;
  position: number;
}

interface CheckoutSettingsValues {
  cartEnabled: boolean;
  thankYouEnabled: boolean;
  thankYouTitle: string;
  thankYouMessage: string;
  thankYouButtonText: string;
  thankYouButtonUrl: string;
  quickContactPhoneEnabled: boolean;
  quickContactPhone: string;
  quickContactWhatsappEnabled: boolean;
  quickContactWhatsapp: string;
  quickContactCountryCode: string;
  trackingEnabled: boolean;
  trackingMethod: string;
}

/**
 * Checkout configuration.
 *
 * The field matrix, the cart toggle, the thank-you popup, quick contact and
 * order tracking all shape the same customer journey, so they live on one
 * screen rather than scattered across five.
 *
 * Phone renders locked: with cash on delivery there is no order without a
 * reachable number, and the server enforces the same rule.
 */
export function CheckoutSettingsView({
  fields,
  customFields,
  settings: initialSettings,
  canManage,
}: {
  fields: ResolvedField[];
  customFields: CustomFieldRow[];
  settings: CheckoutSettingsValues;
  canManage: boolean;
}) {
  const t = useTranslations('settings.checkout');
  const tSettings = useTranslations('settings');
  const tApp = useTranslations('app');
  const tStorefront = useTranslations('storefront');
  const { toast } = useToast();

  const [fieldModes, setFieldModes] = useState(
    Object.fromEntries(fields.map((field) => [field.fieldKey, field.mode])),
  );
  const [settings, setSettings] = useState(initialSettings);
  const [editingField, setEditingField] = useState<CustomFieldRow | null>(null);
  const [creatingField, setCreatingField] = useState(false);

  const fieldsAction = useServerAction(updateCheckoutFieldsAction);
  const settingsAction = useServerAction(updateCheckoutSettingsAction);
  const deleteField = useServerAction(deleteCustomFieldAction);

  const saveFields = async () => {
    const result = await fieldsAction.run({
      fields: fields.map((field) => ({
        fieldKey: field.fieldKey,
        mode: field.locked ? 'REQUIRED' : (fieldModes[field.fieldKey] ?? field.mode),
      })),
    });
    if (result === null) return;
    toast({ title: tSettings('saved'), tone: 'success' });
  };

  const saveSettings = async () => {
    const result = await settingsAction.run(settings);
    if (result === null) return;
    toast({ title: tSettings('saved'), tone: 'success' });
  };

  const set = <K extends keyof CheckoutSettingsValues>(key: K, value: CheckoutSettingsValues[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  return (
    <Tabs defaultValue="fields">
      <TabsList>
        <TabsTrigger value="fields">{t('title')}</TabsTrigger>
        <TabsTrigger value="cart">{tStorefront('cart')}</TabsTrigger>
        <TabsTrigger value="thankyou">{tStorefront('thankYou.title')}</TabsTrigger>
        <TabsTrigger value="contact">{tStorefront('quickContact.call')}</TabsTrigger>
      </TabsList>

      <TabsContent value="fields" className="mt-4 space-y-3">
        <Card>
          <CardHeader title={t('title')} description={t('hint')} />
          <CardBody className="space-y-2">
            <FormError message={fieldsAction.error} />

            {fields.map((field) => (
              <div
                key={field.fieldKey}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] text-foreground">
                    {t(`fields.${field.fieldKey}`)}
                  </span>
                  {field.locked ? (
                    <Badge tone="info" icon={<Lock className="size-3" />}>
                      {tApp('required')}
                    </Badge>
                  ) : null}
                </div>

                <NativeSelect
                  value={field.locked ? 'REQUIRED' : (fieldModes[field.fieldKey] ?? field.mode)}
                  disabled={field.locked || !canManage}
                  aria-label={t(`fields.${field.fieldKey}`)}
                  className="w-36"
                  onChange={(event) =>
                    setFieldModes((current) => ({
                      ...current,
                      [field.fieldKey]: event.target.value as ResolvedField['mode'],
                    }))
                  }
                >
                  <option value="REQUIRED">{t('modes.REQUIRED')}</option>
                  <option value="OPTIONAL">{t('modes.OPTIONAL')}</option>
                  <option value="HIDDEN">{t('modes.HIDDEN')}</option>
                </NativeSelect>
              </div>
            ))}

            <p className="pt-1 text-xs text-subtle-foreground">{t('phoneAlwaysRequired')}</p>

            {canManage ? (
              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm" loading={fieldsAction.submitting} onClick={saveFields}>
                  <Save aria-hidden />
                  {tApp('saveChanges')}
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('customFields')}
            description={t('customFieldsHint')}
            action={
              canManage ? (
                <Button variant="secondary" size="sm" onClick={() => setCreatingField(true)}>
                  <Plus aria-hidden />
                  {t('addCustomField')}
                </Button>
              ) : null
            }
          />
          <CardBody>
            {customFields.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-4 text-center text-xs text-subtle-foreground">
                {t('emptyCustomFields')}
              </p>
            ) : (
              <ul className="space-y-2">
                {customFields.map((field) => (
                  <li
                    key={field.id}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{field.label}</p>
                      <p className="truncate font-mono text-2xs text-subtle-foreground" dir="ltr">
                        {field.fieldKey}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone="outline">{t(`types.${field.type}`)}</Badge>
                      {field.required ? <Badge tone="info">{tApp('required')}</Badge> : null}
                      {!field.isActive ? <Badge tone="neutral">{tApp('inactive')}</Badge> : null}

                      {canManage ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setEditingField(field)}>
                            {tApp('edit')}
                          </Button>
                          <IconButton
                            label={tApp('delete')}
                            icon={<Trash2 />}
                            variant="danger"
                            size="sm"
                            disabled={deleteField.submitting}
                            onClick={async () => {
                              const result = await deleteField.run(field.id);
                              if (result !== null) toast({ title: tApp('delete'), tone: 'success' });
                            }}
                          />
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <CustomFieldDialog
          open={creatingField}
          onOpenChange={setCreatingField}
          field={null}
          nextPosition={customFields.length}
          onSaved={() => setCreatingField(false)}
        />
        <CustomFieldDialog
          open={editingField !== null}
          onOpenChange={(open) => !open && setEditingField(null)}
          field={editingField}
          nextPosition={customFields.length}
          onSaved={() => setEditingField(null)}
        />
      </TabsContent>

      <TabsContent value="cart" className="mt-4">
        <Card>
          <CardHeader title={tStorefront('cart')} />
          <CardBody className="space-y-4">
            <FormError message={settingsAction.error} />

            <SwitchField
              checked={settings.cartEnabled}
              onCheckedChange={(checked) => set('cartEnabled', checked)}
              disabled={!canManage}
              label={tStorefront('cart')}
              hint={tStorefront('emptyCartHint')}
            />

            <SwitchField
              checked={settings.trackingEnabled}
              onCheckedChange={(checked) => set('trackingEnabled', checked)}
              disabled={!canManage}
              label={tStorefront('track')}
            />

            {settings.trackingEnabled ? (
              <Field label={tStorefront('tracking.title')}>
                <NativeSelect
                  value={settings.trackingMethod}
                  disabled={!canManage}
                  onChange={(event) => set('trackingMethod', event.target.value)}
                >
                  <option value="ORDER_NUMBER_AND_PHONE">
                    {tStorefront('tracking.orderNumber')} + {tStorefront('tracking.phone')}
                  </option>
                  <option value="ORDER_NUMBER_ONLY">{tStorefront('tracking.orderNumber')}</option>
                  <option value="PHONE_ONLY">{tStorefront('tracking.phone')}</option>
                </NativeSelect>
              </Field>
            ) : null}

            {canManage ? (
              <div className="flex justify-end">
                <Button variant="primary" size="sm" loading={settingsAction.submitting} onClick={saveSettings}>
                  <Save aria-hidden />
                  {tApp('saveChanges')}
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </TabsContent>

      <TabsContent value="thankyou" className="mt-4">
        <Card>
          <CardHeader title={tStorefront('thankYou.title')} />
          <CardBody className="space-y-4">
            <FormError message={settingsAction.error} />

            <SwitchField
              checked={settings.thankYouEnabled}
              onCheckedChange={(checked) => set('thankYouEnabled', checked)}
              disabled={!canManage}
              label={tApp('enabled')}
            />

            {settings.thankYouEnabled ? (
              <>
                <Field label={tApp('name')}>
                  <Input
                    value={settings.thankYouTitle}
                    disabled={!canManage}
                    onChange={(event) => set('thankYouTitle', event.target.value)}
                  />
                </Field>

                <Field label={tApp('description')}>
                  <Textarea
                    value={settings.thankYouMessage}
                    disabled={!canManage}
                    rows={2}
                    onChange={(event) => set('thankYouMessage', event.target.value)}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={tApp('actions')}>
                    <Input
                      value={settings.thankYouButtonText}
                      disabled={!canManage}
                      onChange={(event) => set('thankYouButtonText', event.target.value)}
                    />
                  </Field>

                  <Field label="URL" optionalLabel={tApp('optional')}>
                    <Input
                      dir="ltr"
                      value={settings.thankYouButtonUrl}
                      disabled={!canManage}
                      onChange={(event) => set('thankYouButtonUrl', event.target.value)}
                    />
                  </Field>
                </div>

                {/* Live preview — the same copy the customer will see. */}
                <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-2 p-5 text-center">
                  <p className="text-sm font-semibold text-foreground">{settings.thankYouTitle}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{settings.thankYouMessage}</p>
                  {settings.thankYouButtonText ? (
                    <span className="mt-3 inline-block rounded-[var(--radius)] bg-primary px-4 py-2 text-xs font-medium text-[var(--primary-foreground)]">
                      {settings.thankYouButtonText}
                    </span>
                  ) : null}
                </div>
              </>
            ) : null}

            {canManage ? (
              <div className="flex justify-end">
                <Button variant="primary" size="sm" loading={settingsAction.submitting} onClick={saveSettings}>
                  <Save aria-hidden />
                  {tApp('saveChanges')}
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </TabsContent>

      <TabsContent value="contact" className="mt-4">
        {/* Anchored so the quick-contact app card can link straight here. */}
        <Card id="quick-contact" className="scroll-mt-20">
          <CardHeader title={tStorefront('quickContact.call')} />
          <CardBody className="space-y-4">
            <FormError message={settingsAction.error} />

            <SwitchField
              checked={settings.quickContactPhoneEnabled}
              onCheckedChange={(checked) => set('quickContactPhoneEnabled', checked)}
              disabled={!canManage}
              label={tStorefront('quickContact.call')}
            />

            {settings.quickContactPhoneEnabled ? (
              <Field label={tApp('phone')}>
                <Input
                  type="tel"
                  dir="ltr"
                  value={settings.quickContactPhone}
                  disabled={!canManage}
                  onChange={(event) => set('quickContactPhone', event.target.value)}
                />
              </Field>
            ) : null}

            <SwitchField
              checked={settings.quickContactWhatsappEnabled}
              onCheckedChange={(checked) => set('quickContactWhatsappEnabled', checked)}
              disabled={!canManage}
              label="WhatsApp"
            />

            {settings.quickContactWhatsappEnabled ? (
              <Field label="WhatsApp">
                <Input
                  type="tel"
                  dir="ltr"
                  value={settings.quickContactWhatsapp}
                  disabled={!canManage}
                  onChange={(event) => set('quickContactWhatsapp', event.target.value)}
                />
              </Field>
            ) : null}

            {canManage ? (
              <div className="flex justify-end">
                <Button variant="primary" size="sm" loading={settingsAction.submitting} onClick={saveSettings}>
                  <Save aria-hidden />
                  {tApp('saveChanges')}
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function CustomFieldDialog({
  open,
  onOpenChange,
  field,
  nextPosition,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldRow | null;
  nextPosition: number;
  onSaved: () => void;
}) {
  const t = useTranslations('settings.checkout');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [label, setLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [type, setType] = useState<CustomFieldRow['type']>('TEXT');
  const [placeholder, setPlaceholder] = useState('');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [keyTouched, setKeyTouched] = useState(false);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (open && (field?.id ?? 'new') !== seededFor) {
    setSeededFor(field?.id ?? 'new');
    setLabel(field?.label ?? '');
    setFieldKey(field?.fieldKey ?? '');
    setType(field?.type ?? 'TEXT');
    setPlaceholder(field?.placeholder ?? '');
    setRequired(field?.required ?? false);
    setOptions(field?.options ?? []);
    setKeyTouched(Boolean(field));
  }

  const action = useServerAction(async (input: unknown) =>
    saveCustomFieldAction(field?.id ?? null, input),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await action.run({
      label,
      fieldKey: fieldKey || normaliseFieldKey(label),
      type,
      placeholder,
      helpText: '',
      required,
      options,
      isActive: true,
      position: field?.position ?? nextPosition,
    });
    if (result === null) return;
    toast({ title: tApp('save'), tone: 'success' });
    onSaved();
  };

  const needsOptions = type === 'SELECT' || type === 'RADIO';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('addCustomField')}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={action.submitting}>
              {tApp('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={submit as unknown as () => void}
              loading={action.submitting}
            >
              {tApp('save')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={action.error} />

          <Field label={t('fieldLabel')} required error={action.fieldError('label')}>
            <Input
              value={label}
              autoFocus
              onChange={(event) => {
                setLabel(event.target.value);
                if (!keyTouched) setFieldKey(normaliseFieldKey(event.target.value));
              }}
            />
          </Field>

          <Field label={t('fieldKey')} required error={action.fieldError('fieldKey')}>
            <Input
              dir="ltr"
              value={fieldKey}
              onChange={(event) => {
                setKeyTouched(true);
                setFieldKey(event.target.value);
              }}
            />
          </Field>

          <Field label={t('fieldType')}>
            <NativeSelect
              value={type}
              onChange={(event) => setType(event.target.value as CustomFieldRow['type'])}
            >
              <option value="TEXT">{t('types.TEXT')}</option>
              <option value="TEXTAREA">{t('types.TEXTAREA')}</option>
              <option value="SELECT">{t('types.SELECT')}</option>
              <option value="RADIO">{t('types.RADIO')}</option>
              <option value="CHECKBOX">{t('types.CHECKBOX')}</option>
              <option value="NUMBER">{t('types.NUMBER')}</option>
            </NativeSelect>
          </Field>

          {needsOptions ? (
            <Field label={t('fieldOptions')} required error={action.fieldError('options')}>
              <TagInput value={options} onChange={setOptions} />
            </Field>
          ) : null}

          <Field label={t('fieldPlaceholder')} optionalLabel={tApp('optional')}>
            <Input value={placeholder} onChange={(event) => setPlaceholder(event.target.value)} />
          </Field>

          <SwitchField checked={required} onCheckedChange={setRequired} label={t('fieldRequired')} />

          <button type="submit" className="sr-only">
            {tApp('save')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
