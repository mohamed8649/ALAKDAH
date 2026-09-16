'use client';

import { Percent, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { archiveCampaignAction, saveCampaignAction } from '@/app/actions/campaigns';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { CheckboxField, SwitchField } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatDateTime } from '@/lib/datetime';

interface CampaignRow {
  id: string;
  name: string;
  discountPercent: number;
  startAt: string;
  endAt: string;
  isActive: boolean;
  appliesToAll: boolean;
  productIds: string[];
  productCount: number;
  state: string;
}

const STATE_TONE: Record<string, BadgeTone> = {
  running: 'success',
  scheduled: 'info',
  ended: 'neutral',
  paused: 'warning',
};

/**
 * Campaigns.
 *
 * The state chip (running / scheduled / ended) is computed on the server in the
 * store's timezone and passed down, so the merchant and the checkout always
 * agree on whether a discount is live.
 */
export function CampaignsManager({
  campaigns,
  products,
  locale,
  timezone,
  canManage,
}: {
  campaigns: CampaignRow[];
  products: Array<{ id: string; name: string }>;
  locale: string;
  timezone: string;
  canManage: boolean;
}) {
  const t = useTranslations('campaigns');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CampaignRow | null>(null);

  const archive = useServerAction(archiveCampaignAction);

  return (
    <div className="space-y-3">
      <p className="text-xs text-subtle-foreground">{t('timezoneNote', { timezone })}</p>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Percent />}
            title={t('empty')}
            description={t('emptyDescription')}
            action={
              canManage ? (
                <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                  <Plus aria-hidden />
                  {t('create')}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {canManage ? (
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {t('create')}
              </Button>
            </div>
          ) : null}

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Card>
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {campaign.name}
                        </p>
                        <p className="mt-0.5 text-2xs text-subtle-foreground">
                          {formatDateTime(campaign.startAt, locale, timezone)} —{' '}
                          {formatDateTime(campaign.endAt, locale, timezone)}
                        </p>
                      </div>

                      <span className="shrink-0 text-lg font-bold tabular-nums text-primary">
                        {campaign.discountPercent}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={STATE_TONE[campaign.state] ?? 'neutral'} dot>
                        {t(`state.${campaign.state}`)}
                      </Badge>
                      <Badge tone="outline">
                        {campaign.appliesToAll
                          ? tApp('all')
                          : `${campaign.productCount} ${tApp('results')}`}
                      </Badge>
                    </div>

                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(campaign)}
                          className="flex-1"
                        >
                          {tApp('edit')}
                        </Button>
                        <IconButton
                          label={tApp('delete')}
                          icon={<Trash2 />}
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleting(campaign)}
                        />
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <CampaignDialog
        open={creating}
        onOpenChange={setCreating}
        campaign={null}
        products={products}
        onSaved={() => setCreating(false)}
      />
      <CampaignDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        campaign={editing}
        products={products}
        onSaved={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('title')}
        description={t('emptyDescription')}
        confirmLabel={tApp('delete')}
        cancelLabel={tApp('cancel')}
        loading={archive.submitting}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await archive.run(deleting.id);
          setDeleting(null);
          if (result !== null) toast({ title: tApp('delete'), tone: 'success' });
        }}
      />
    </div>
  );
}

/** ISO instant -> value for <input type="datetime-local">. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function CampaignDialog({
  open,
  onOpenChange,
  campaign,
  products,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignRow | null;
  products: Array<{ id: string; name: string }>;
  onSaved: () => void;
}) {
  const t = useTranslations('campaigns');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [appliesToAll, setAppliesToAll] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (open && (campaign?.id ?? 'new') !== seededFor) {
    setSeededFor(campaign?.id ?? 'new');
    setName(campaign?.name ?? '');
    setDiscountPercent(String(campaign?.discountPercent ?? 10));
    setStartAt(campaign ? toLocalInput(campaign.startAt) : toLocalInput(new Date().toISOString()));
    setEndAt(
      campaign
        ? toLocalInput(campaign.endAt)
        : toLocalInput(new Date(Date.now() + 7 * 86_400_000).toISOString()),
    );
    setIsActive(campaign?.isActive ?? true);
    setAppliesToAll(campaign?.appliesToAll ?? false);
    setProductIds(campaign?.productIds ?? []);
  }

  const action = useServerAction(async (input: unknown) =>
    saveCampaignAction(campaign?.id ?? null, input),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await action.run({
      name,
      discountPercent,
      // datetime-local has no zone; converting through Date gives the UTC
      // instant the server stores.
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      isActive,
      appliesToAll,
      productIds,
    });

    if (result === null) return;
    toast({ title: tApp('save'), tone: 'success' });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={campaign ? tApp('edit') : t('create')}
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

          <Field label={t('fields.name')} required error={action.fieldError('name')}>
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t('fields.discountPercent')}
              required
              error={action.fieldError('discountPercent')}
            >
              <Input
                value={discountPercent}
                inputMode="numeric"
                adornEnd="%"
                onChange={(event) => setDiscountPercent(event.target.value)}
              />
            </Field>

            <Field label={t('fields.startAt')} required error={action.fieldError('startAt')}>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
              />
            </Field>

            <Field label={t('fields.endAt')} required error={action.fieldError('endAt')}>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
              />
            </Field>
          </div>

          <SwitchField checked={isActive} onCheckedChange={setIsActive} label={tApp('active')} />

          <SwitchField
            checked={appliesToAll}
            onCheckedChange={setAppliesToAll}
            label={t('fields.appliesToAll')}
          />

          {!appliesToAll ? (
            <Field label={t('fields.products')} error={action.fieldError('productIds')}>
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-[var(--radius)] border border-border p-3">
                {products.map((product) => (
                  <CheckboxField
                    key={product.id}
                    checked={productIds.includes(product.id)}
                    onCheckedChange={(checked) =>
                      setProductIds((current) =>
                        checked
                          ? [...current, product.id]
                          : current.filter((id) => id !== product.id),
                      )
                    }
                    label={product.name}
                  />
                ))}
              </div>
            </Field>
          ) : null}

          <button type="submit" className="sr-only">
            {tApp('save')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
