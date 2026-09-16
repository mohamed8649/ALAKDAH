'use client';

import { MapPin, MoreHorizontal, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';

import { archiveShippingMethodAction, saveShippingMethodAction } from '@/app/actions/shipping';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SwitchField,
} from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { TagInput } from '@/features/shared/tag-input';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatMoney, toDecimalString } from '@/lib/money';

interface ZoneRow {
  id: string;
  name: string;
  price: number;
  regions: string[];
  cities: string[];
}

export interface MethodRow {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  type: 'DELIVERY' | 'PICKUP' | 'EXPRESS';
  price: number;
  isActive: boolean;
  isDefault: boolean;
  supportsCod: boolean;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  zones: ZoneRow[];
}

/**
 * Delivery methods.
 *
 * A method is not a single price field: it owns a list of zones, and each zone
 * prices a set of regions or cities. A zone with no regions is the method's
 * fallback, which is what keeps checkout quotable for a destination the merchant
 * never explicitly listed.
 */
export function ShippingMethodsManager({
  methods,
  locale,
  currency,
  canManage,
}: {
  methods: MethodRow[];
  locale: string;
  currency: string;
  canManage: boolean;
}) {
  const t = useTranslations('shipping');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [editing, setEditing] = useState<MethodRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MethodRow | null>(null);

  const archive = useServerAction(archiveShippingMethodAction);

  if (methods.length === 0) {
    return (
      <>
        <Card>
          <EmptyState
            icon={<Truck />}
            title={t('emptyMethods')}
            description={t('emptyMethodsDescription')}
            action={
              canManage ? (
                <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                  <Plus aria-hidden />
                  {t('createMethod')}
                </Button>
              ) : undefined
            }
          />
        </Card>
        <MethodDialog
          open={creating}
          onOpenChange={setCreating}
          method={null}
          currency={currency}
          onSaved={() => setCreating(false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {t('createMethod')}
          </Button>
        </div>
      ) : null}

      <ul className="grid gap-3 lg:grid-cols-2">
        {methods.map((method) => (
          <li key={method.id}>
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{method.name}</p>
                    {method.description ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {method.description}
                      </p>
                    ) : null}
                  </div>

                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton label={tApp('actions')} icon={<MoreHorizontal />} size="sm" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(method)}>
                          <Pencil />
                          {tApp('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem tone="danger" onSelect={() => setDeleting(method)}>
                          <Trash2 />
                          {tApp('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={method.isActive ? 'success' : 'neutral'} dot>
                    {method.isActive ? tApp('active') : tApp('inactive')}
                  </Badge>
                  {method.isDefault ? (
                    <Badge tone="primary">{t('methodFields.isDefault')}</Badge>
                  ) : null}
                  <Badge tone="outline">{t(`methodType.${method.type}`)}</Badge>
                  {method.supportsCod ? <Badge tone="info">COD</Badge> : null}
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-subtle-foreground">
                    {t('methodFields.price')}
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-foreground">
                    {formatMoney(method.price, currency, locale)}
                  </span>
                </div>

                {method.zones.length > 0 ? (
                  <ul className="space-y-1 border-t border-border pt-2">
                    {method.zones.map((zone) => (
                      <li key={zone.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                          <MapPin className="size-3 shrink-0 text-subtle-foreground" aria-hidden />
                          <span className="truncate">
                            {zone.name}
                            {zone.regions.length === 0 && zone.cities.length === 0 ? (
                              <span className="ms-1 text-subtle-foreground">
                                ({t('zones.fallback')})
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground">
                          {formatMoney(zone.price, currency, locale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-border pt-2 text-xs text-subtle-foreground">
                    {t('zones.empty')}
                  </p>
                )}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <MethodDialog
        open={creating}
        onOpenChange={setCreating}
        method={null}
        currency={currency}
        onSaved={() => setCreating(false)}
      />
      <MethodDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        method={editing}
        currency={currency}
        onSaved={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('editMethod')}
        description={t('disconnectWarning')}
        confirmLabel={tApp('delete')}
        cancelLabel={tApp('cancel')}
        loading={archive.submitting}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await archive.run(deleting.id);
          setDeleting(null);
          if (result !== null) toast({ title: tApp('delete'), tone: 'success' });
          else if (archive.error) toast({ title: archive.error, tone: 'error' });
        }}
      />
    </div>
  );
}

interface ZoneDraft {
  key: string;
  id?: string;
  name: string;
  price: string;
  regions: string[];
  cities: string[];
}

function MethodDialog({
  open,
  onOpenChange,
  method,
  currency,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: MethodRow | null;
  currency: string;
  onSaved: () => void;
}) {
  const t = useTranslations('shipping');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MethodRow['type']>('DELIVERY');
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [supportsCod, setSupportsCod] = useState(true);
  const [minDays, setMinDays] = useState('');
  const [maxDays, setMaxDays] = useState('');
  const [zones, setZones] = useState<ZoneDraft[]>([]);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (open && (method?.id ?? 'new') !== seededFor) {
    setSeededFor(method?.id ?? 'new');
    setName(method?.name ?? '');
    setDescription(method?.description ?? '');
    setType(method?.type ?? 'DELIVERY');
    setPrice(method ? toDecimalString(method.price, currency) : '');
    setIsActive(method?.isActive ?? true);
    setIsDefault(method?.isDefault ?? false);
    setSupportsCod(method?.supportsCod ?? true);
    setMinDays(method?.minDeliveryDays != null ? String(method.minDeliveryDays) : '');
    setMaxDays(method?.maxDeliveryDays != null ? String(method.maxDeliveryDays) : '');
    setZones(
      (method?.zones ?? []).map((zone, index) => ({
        key: `${zone.id}-${index}`,
        id: zone.id,
        name: zone.name,
        price: toDecimalString(zone.price, currency),
        regions: zone.regions,
        cities: zone.cities,
      })),
    );
  }

  const action = useServerAction(async (input: unknown) =>
    saveShippingMethodAction(method?.id ?? null, input),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await action.run({
      name,
      description,
      type,
      price,
      isActive,
      isDefault,
      supportsCod,
      minDeliveryDays: minDays ? Number(minDays) : null,
      maxDeliveryDays: maxDays ? Number(maxDays) : null,
      zones: zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        price: zone.price,
        regions: zone.regions,
        cities: zone.cities,
      })),
    });

    if (result === null) return;
    toast({ title: tApp('save'), tone: 'success' });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={method ? t('editMethod') : t('createMethod')}
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

          <Field label={t('methodFields.name')} required error={action.fieldError('name')}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('methodFields.namePlaceholder')}
              autoFocus
            />
          </Field>

          <Field label={t('methodFields.description')} optionalLabel={tApp('optional')}>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('methodFields.type')}>
              <NativeSelect
                value={type}
                onChange={(event) => setType(event.target.value as MethodRow['type'])}
              >
                <option value="DELIVERY">{t('methodType.DELIVERY')}</option>
                <option value="EXPRESS">{t('methodType.EXPRESS')}</option>
                <option value="PICKUP">{t('methodType.PICKUP')}</option>
              </NativeSelect>
            </Field>

            <Field label={t('methodFields.price')} required error={action.fieldError('price')}>
              <Input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                adornEnd={currency}
              />
            </Field>

            <Field label={t('methodFields.minDays')} optionalLabel={tApp('optional')}>
              <Input
                value={minDays}
                onChange={(event) => setMinDays(event.target.value)}
                inputMode="numeric"
              />
            </Field>

            <Field label={t('methodFields.maxDays')} optionalLabel={tApp('optional')}>
              <Input
                value={maxDays}
                onChange={(event) => setMaxDays(event.target.value)}
                inputMode="numeric"
              />
            </Field>
          </div>

          <div className="space-y-2 rounded-[var(--radius)] border border-border p-3">
            <SwitchField checked={isActive} onCheckedChange={setIsActive} label={tApp('active')} />
            <SwitchField
              checked={isDefault}
              onCheckedChange={setIsDefault}
              label={t('methodFields.isDefault')}
            />
            <SwitchField
              checked={supportsCod}
              onCheckedChange={setSupportsCod}
              label={t('methodFields.supportsCod')}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-foreground">{t('zones.title')}</p>
                <p className="mt-0.5 text-xs text-subtle-foreground">{t('zones.hint')}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setZones((current) => [
                    ...current,
                    {
                      key: `new-${Date.now()}`,
                      name: '',
                      price: price || '',
                      regions: [],
                      cities: [],
                    },
                  ])
                }
              >
                <Plus aria-hidden />
                {t('zones.add')}
              </Button>
            </div>

            {zones.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-3 text-center text-xs text-subtle-foreground">
                {t('zones.empty')}
              </p>
            ) : (
              <ul className="space-y-3">
                {zones.map((zone, index) => (
                  <li key={zone.key} className="rounded-[var(--radius)] border border-border p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                      <Field label={t('zones.name')}>
                        <Input
                          value={zone.name}
                          onChange={(event) =>
                            setZones((current) =>
                              current.map((entry, position) =>
                                position === index ? { ...entry, name: event.target.value } : entry,
                              ),
                            )
                          }
                        />
                      </Field>

                      <Field label={t('zones.price')}>
                        <Input
                          value={zone.price}
                          inputMode="decimal"
                          adornEnd={currency}
                          className="sm:w-36"
                          onChange={(event) =>
                            setZones((current) =>
                              current.map((entry, position) =>
                                position === index ? { ...entry, price: event.target.value } : entry,
                              ),
                            )
                          }
                        />
                      </Field>

                      <div className="flex items-end pb-1">
                        <IconButton
                          label={tApp('delete')}
                          icon={<Trash2 />}
                          variant="danger"
                          onClick={() =>
                            setZones((current) =>
                              current.filter((_, position) => position !== index),
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label={t('zones.regions')}>
                        <TagInput
                          value={zone.regions}
                          placeholder={t('zones.regionsPlaceholder')}
                          onChange={(regions) =>
                            setZones((current) =>
                              current.map((entry, position) =>
                                position === index ? { ...entry, regions } : entry,
                              ),
                            )
                          }
                        />
                      </Field>

                      <Field label={t('zones.cities')}>
                        <TagInput
                          value={zone.cities}
                          placeholder={t('zones.citiesPlaceholder')}
                          onChange={(cities) =>
                            setZones((current) =>
                              current.map((entry, position) =>
                                position === index ? { ...entry, cities } : entry,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" className="sr-only">
            {tApp('save')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
