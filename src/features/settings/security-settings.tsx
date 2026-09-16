'use client';

import { Ban, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { blockIpAction, unblockIpAction, updateSecurityAction } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { SwitchField } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatDate } from '@/lib/datetime';

interface SecurityValues {
  fraudProtectionEnabled: boolean;
  fraudMaxOrders: number;
  fraudWindowHours: number;
  fraudAction: 'BLOCK' | 'FLAG' | 'ALLOW';
  abandonedTrackingEnabled: boolean;
}

interface BlockedIpRow {
  id: string;
  ip: string;
  reason: string | null;
  createdAt: string;
}

/**
 * Security settings.
 *
 * Duplicate-order protection defaults to FLAG rather than BLOCK: a genuine
 * repeat customer silently rejected is a lost sale the merchant never hears
 * about, whereas a flagged order is one they can review.
 */
export function SecuritySettingsView({
  initial,
  blockedIps,
  locale,
  canManage,
}: {
  initial: SecurityValues;
  blockedIps: BlockedIpRow[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations('settings.security');
  const tSettings = useTranslations('settings');
  const tApp = useTranslations('app');
  const tAbandoned = useTranslations('abandoned');
  const { toast } = useToast();

  const [values, setValues] = useState(initial);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');

  const action = useServerAction(updateSecurityAction);
  const block = useServerAction(async (input: { ip: string; reason: string }) =>
    blockIpAction(input.ip, input.reason),
  );
  const unblock = useServerAction(unblockIpAction);

  const set = <K extends keyof SecurityValues>(key: K, value: SecurityValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const result = await action.run(values);
    if (result === null) return;
    toast({ title: tSettings('saved'), tone: 'success' });
  };

  const addIp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newIp.trim()) return;

    const result = await block.run({ ip: newIp, reason: newReason });
    if (result === null) return;

    setNewIp('');
    setNewReason('');
    toast({ title: t('addIp'), tone: 'success' });
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader title={t('fraudProtection')} description={t('fraudHint')} />
        <CardBody className="space-y-4">
          <FormError message={action.error} />

          <SwitchField
            checked={values.fraudProtectionEnabled}
            onCheckedChange={(checked) => set('fraudProtectionEnabled', checked)}
            disabled={!canManage}
            label={t('fraudProtection')}
          />

          {values.fraudProtectionEnabled ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('maxOrders')}>
                <Input
                  inputMode="numeric"
                  value={String(values.fraudMaxOrders)}
                  disabled={!canManage}
                  onChange={(event) =>
                    set('fraudMaxOrders', Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </Field>

              <Field label={t('windowHours')}>
                <Input
                  inputMode="numeric"
                  value={String(values.fraudWindowHours)}
                  disabled={!canManage}
                  onChange={(event) =>
                    set('fraudWindowHours', Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </Field>

              <Field label={t('action')}>
                <NativeSelect
                  value={values.fraudAction}
                  disabled={!canManage}
                  onChange={(event) =>
                    set('fraudAction', event.target.value as SecurityValues['fraudAction'])
                  }
                >
                  <option value="FLAG">{t('actions.FLAG')}</option>
                  <option value="BLOCK">{t('actions.BLOCK')}</option>
                  <option value="ALLOW">{t('actions.ALLOW')}</option>
                </NativeSelect>
              </Field>
            </div>
          ) : null}

          <div className="border-t border-border pt-3">
            <SwitchField
              checked={values.abandonedTrackingEnabled}
              onCheckedChange={(checked) => set('abandonedTrackingEnabled', checked)}
              disabled={!canManage}
              label={tAbandoned('title')}
              hint={tAbandoned('privacyNote')}
            />
          </div>

          {canManage ? (
            <div className="flex justify-end">
              <Button variant="primary" size="sm" loading={action.submitting} onClick={save}>
                <Save aria-hidden />
                {tApp('saveChanges')}
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('ipBlacklist')} description={t('ipHint')} />
        <CardBody className="space-y-4">
          {canManage ? (
            <form onSubmit={addIp} className="flex flex-wrap items-end gap-2">
              <Field label={t('ipAddress')} className="min-w-40 flex-1">
                <Input
                  dir="ltr"
                  value={newIp}
                  placeholder="203.0.113.10"
                  onChange={(event) => setNewIp(event.target.value)}
                />
              </Field>
              <Field label={t('reason')} optionalLabel={tApp('optional')} className="min-w-40 flex-1">
                <Input value={newReason} onChange={(event) => setNewReason(event.target.value)} />
              </Field>
              <Button type="submit" variant="secondary" loading={block.submitting}>
                <Plus aria-hidden />
                {t('addIp')}
              </Button>
            </form>
          ) : null}

          {blockedIps.length === 0 ? (
            <EmptyState compact icon={<Ban />} title={t('emptyIps')} />
          ) : (
            <ul className="space-y-2">
              {blockedIps.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px] text-foreground" dir="ltr">
                      {entry.ip}
                    </p>
                    {entry.reason ? (
                      <p className="truncate text-xs text-muted-foreground">{entry.reason}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-2xs text-subtle-foreground">
                      {formatDate(entry.createdAt, locale)}
                    </span>
                    {canManage ? (
                      <IconButton
                        label={tApp('delete')}
                        icon={<Trash2 />}
                        variant="danger"
                        size="sm"
                        disabled={unblock.submitting}
                        onClick={async () => {
                          const result = await unblock.run(entry.id);
                          if (result !== null) toast({ title: tApp('delete'), tone: 'success' });
                        }}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
