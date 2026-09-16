'use client';

import { AlertTriangle, Wand2 } from 'lucide-react';
import { useState } from 'react';

import { removePixelAction, savePixelAction } from '@/app/actions/pixels';
import { Icon } from '@/components/layout/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { SwitchField } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';

export interface PixelRow {
  providerKey: string;
  nameAr: string;
  icon: string;
  idPlaceholder: string;
  standardEvents: string[];
  supportsServerToken: boolean;
  pixelId: string;
  isActive: boolean;
  eventMapping: Record<string, string>;
  hasServerToken: boolean;
  serverTokenMask: string | null;
  /** Provider-side names suggested for our events, money events excluded. */
  suggested: Record<string, string>;
}

const TRACKABLE_EVENTS = [
  'page_view',
  'product_view',
  'add_to_cart',
  'checkout_started',
  'order_created',
  'order_confirmed',
  'order_delivered',
] as const;

/** Events whose meaning is a business decision in a COD shop. */
const REVENUE_EVENTS = new Set(['order_created', 'order_confirmed', 'order_delivered']);

/**
 * Pixel configuration.
 *
 * Every event is unmapped until the merchant maps it. That is most visible on
 * the three order events: which of "placed", "confirmed by phone" and
 * "delivered and paid" counts as a conversion is a decision only the merchant
 * can make, and getting it wrong is how a COD store teaches its ad account to
 * chase orders that never get paid for.
 */
export function PixelsManager({ pixels }: { pixels: PixelRow[] }) {
  const t = useTranslations('pixels');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [editing, setEditing] = useState<PixelRow | null>(null);
  const [pixelId, setPixelId] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [serverToken, setServerToken] = useState('');
  const [removing, setRemoving] = useState<PixelRow | null>(null);

  const save = useServerAction(savePixelAction);
  const remove = useServerAction(removePixelAction);

  const open = (pixel: PixelRow) => {
    save.reset();
    setPixelId(pixel.pixelId);
    setIsActive(pixel.isActive);
    setMapping({ ...pixel.eventMapping });
    setServerToken('');
    setEditing(pixel);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const result = await save.run({
      providerKey: editing.providerKey,
      pixelId,
      isActive,
      eventMapping: mapping,
      serverToken,
    });
    if (result === null) return;

    setEditing(null);
    toast({ title: tApp('save'), tone: 'success' });
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const result = await remove.run(removing.providerKey);
    setRemoving(null);
    if (result === null) return;
    toast({ title: t('removed'), tone: 'success' });
  };

  const mappedCount = (pixel: PixelRow) => Object.keys(pixel.eventMapping).length;

  return (
    <>
      <p className="mb-3 flex items-start gap-2 rounded-[var(--radius)] border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
        <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
        {t('codWarning')}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pixels.map((pixel) => (
          <li key={pixel.providerKey}>
            <Card className="h-full">
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-surface-3 text-muted-foreground">
                    <Icon name={pixel.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{pixel.nameAr}</p>
                    {pixel.pixelId ? (
                      <p dir="ltr" className="mt-0.5 truncate font-mono text-xs text-subtle-foreground">
                        {pixel.pixelId}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {pixel.isActive ? (
                    <Badge tone="success" dot>
                      {tApp('active')}
                    </Badge>
                  ) : (
                    <Badge tone="outline">{tApp('inactive')}</Badge>
                  )}
                  <Badge tone={mappedCount(pixel) > 0 ? 'primary' : 'warning'}>
                    {t('mappedCount', { count: mappedCount(pixel) })}
                  </Badge>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => open(pixel)}>
                    {pixel.pixelId ? tApp('edit') : t('setup')}
                  </Button>
                  {pixel.pixelId ? (
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(pixel)}>
                      {tApp('delete')}
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          size="lg"
          title={editing?.nameAr ?? ''}
          description={t('mappingNote')}
          footer={
            <Button type="submit" form="pixel-form" variant="primary" loading={save.submitting}>
              {tApp('save')}
            </Button>
          }
        >
          <form id="pixel-form" onSubmit={submit} noValidate className="space-y-4">
            <FormError message={save.error} />

            <Field label={t('pixelId')} required error={save.fieldError('pixelId')}>
              <Input
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                placeholder={editing?.idPlaceholder}
                value={pixelId}
                onChange={(event) => setPixelId(event.target.value)}
                className="font-mono"
              />
            </Field>

            <SwitchField
              checked={isActive}
              onCheckedChange={setIsActive}
              label={t('activeLabel')}
              hint={t('activeHint')}
            />

            {editing?.supportsServerToken ? (
              <Field
                label={t('serverToken')}
                optionalLabel={tApp('optional')}
                hint={
                  editing.serverTokenMask
                    ? t('tokenStored', { mask: editing.serverTokenMask })
                    : t('serverTokenHint')
                }
              >
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  value={serverToken}
                  onChange={(event) => setServerToken(event.target.value)}
                />
              </Field>
            ) : null}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-foreground">{t('eventMapping')}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMapping({ ...(editing?.suggested ?? {}) })}
                >
                  <Wand2 aria-hidden />
                  {t('useSuggested')}
                </Button>
              </div>

              <ul className="space-y-2">
                {TRACKABLE_EVENTS.map((event) => (
                  <li key={event} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr] sm:gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{t(`events.${event}`)}</p>
                      {REVENUE_EVENTS.has(event) ? (
                        <p className="text-2xs leading-relaxed text-warning">
                          {t('revenueEventHint')}
                        </p>
                      ) : null}
                    </div>
                    <NativeSelect
                      aria-label={t(`events.${event}`)}
                      value={mapping[event] ?? ''}
                      onChange={(change) =>
                        setMapping((current) => {
                          const next = { ...current };
                          if (change.target.value) next[event] = change.target.value;
                          else delete next[event];
                          return next;
                        })
                      }
                    >
                      <option value="">{t('notSent')}</option>
                      {editing?.standardEvents.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </NativeSelect>
                  </li>
                ))}
              </ul>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('removeTitle')}
        description={t('removeWarning')}
        confirmLabel={tApp('delete')}
        cancelLabel={tApp('cancel')}
        loading={remove.submitting}
        onConfirm={confirmRemove}
      />
    </>
  );
}
