'use client';

import Link from 'next/link';
import { CheckCircle2, Plug, Upload, XCircle } from 'lucide-react';
import { useState } from 'react';

import {
  connectIntegrationAction,
  disconnectIntegrationAction,
  testIntegrationAction,
} from '@/app/actions/integrations';
import { Icon } from '@/components/layout/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatDateTime } from '@/lib/datetime';

interface CredentialFieldRow {
  key: string;
  labelAr: string;
  secret: boolean;
  required: boolean;
  placeholder?: string;
  helpAr?: string;
}

export interface IntegrationRow {
  providerKey: string;
  nameAr: string;
  descriptionAr: string;
  icon: string;
  capabilities: string[];
  credentialFields: CredentialFieldRow[];
  proposal: boolean;
  status: 'DISCONNECTED' | 'CONNECTED' | 'ERROR';
  publicValues: Record<string, string>;
  secretMasks: Record<string, string>;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
}

/**
 * Integration connections.
 *
 * Non-secret settings (a spreadsheet id, a shop domain) are prefilled so the
 * merchant can see what is configured. Secrets are not: a stored secret shows
 * as a mask with an empty input beside it, and leaving that input blank keeps
 * what is already saved. Nothing here can read a credential back out.
 */
export function IntegrationsManager({
  integrations,
  locale,
}: {
  integrations: IntegrationRow[];
  locale: string;
}) {
  const t = useTranslations('integrations');
  const tApp = useTranslations('app');
  const currentLocale = useLocale();
  const { toast } = useToast();

  const [editing, setEditing] = useState<IntegrationRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [disconnecting, setDisconnecting] = useState<IntegrationRow | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const connect = useServerAction(connectIntegrationAction);
  const disconnect = useServerAction(disconnectIntegrationAction);

  const openEditor = (integration: IntegrationRow) => {
    connect.reset();
    // Secrets start blank on purpose — a mask is not an editable value.
    setValues({ ...integration.publicValues });
    setEditing(integration);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const result = await connect.run({
      providerKey: editing.providerKey,
      credentials: values,
    });
    if (result === null) return;

    setEditing(null);
    toast({ title: t('connected'), tone: 'success' });
  };

  const test = async (integration: IntegrationRow) => {
    setTesting(integration.providerKey);
    const result = await testIntegrationAction(integration.providerKey);
    setTesting(null);

    if (!result.ok) {
      toast({ title: tApp('retry'), tone: 'error' });
      return;
    }
    toast({
      title: t(result.data.ok ? 'testPassed' : 'testMissingCredentials'),
      tone: result.data.ok ? 'success' : 'error',
    });
  };

  const confirmDisconnect = async () => {
    if (!disconnecting) return;
    const result = await disconnect.run(disconnecting.providerKey);
    setDisconnecting(null);
    if (result === null) return;
    toast({ title: t('disconnected'), tone: 'success' });
  };

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => (
          <li key={integration.providerKey}>
            <Card className="h-full">
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-surface-3 text-muted-foreground">
                    <Icon name={integration.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {integration.nameAr}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {integration.descriptionAr}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {integration.status === 'CONNECTED' ? (
                    <Badge tone="success" icon={<CheckCircle2 className="size-3" />}>
                      {t('statusConnected')}
                    </Badge>
                  ) : integration.status === 'ERROR' ? (
                    <Badge tone="danger" icon={<XCircle className="size-3" />}>
                      {t('statusError')}
                    </Badge>
                  ) : (
                    <Badge tone="outline">{t('statusDisconnected')}</Badge>
                  )}

                  {integration.proposal ? <Badge tone="warning">{t('proposal')}</Badge> : null}

                  {integration.capabilities.map((capability) => (
                    <Badge key={capability} tone="outline">
                      {t(`capabilities.${capability}`)}
                    </Badge>
                  ))}
                </div>

                {integration.lastSyncAt ? (
                  <p className="text-xs text-subtle-foreground">
                    {/* An absolute date rather than "3 minutes ago": this one is
                        interpolated into a sentence, so it cannot be a component,
                        and a relative string computed during render would not
                        survive hydration. */}
                    {t('lastSync', {
                      when: formatDateTime(integration.lastSyncAt, currentLocale),
                    })}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button
                    variant={integration.status === 'CONNECTED' ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() => openEditor(integration)}
                    className="flex-1"
                  >
                    <Plug aria-hidden />
                    {integration.status === 'CONNECTED' ? tApp('edit') : t('connect')}
                  </Button>

                  {integration.status !== 'DISCONNECTED' ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={testing === integration.providerKey}
                        onClick={() => test(integration)}
                      >
                        {t('test')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisconnecting(integration)}
                      >
                        {t('disconnect')}
                      </Button>
                    </>
                  ) : null}
                </div>

                {integration.capabilities.some((capability) => capability.startsWith('import')) ? (
                  <Link
                    href={`/${locale}/dashboard/integrations/import?source=${integration.providerKey}`}
                    className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
                  >
                    <Upload className="size-3.5" aria-hidden />
                    {t('startImport')}
                  </Link>
                ) : null}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          title={editing?.nameAr ?? ''}
          description={t('credentialsNote')}
          footer={
            <Button
              type="submit"
              form="integration-form"
              variant="primary"
              loading={connect.submitting}
            >
              {tApp('save')}
            </Button>
          }
        >
          <form id="integration-form" onSubmit={save} noValidate className="space-y-4">
            <FormError message={connect.error} />

            {editing?.credentialFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('noCredentialsNeeded')}</p>
            ) : null}

            {editing?.credentialFields.map((field) => {
              const mask = editing.secretMasks[field.key];
              return (
                <Field
                  key={field.key}
                  label={field.labelAr}
                  required={field.required && !mask}
                  optionalLabel={field.required ? undefined : tApp('optional')}
                  hint={mask ? t('secretStored', { mask }) : field.helpAr}
                  error={connect.fieldError(field.key)}
                >
                  <Input
                    type={field.secret ? 'password' : 'text'}
                    dir={field.secret ? 'ltr' : undefined}
                    autoComplete="off"
                    placeholder={mask ? t('leaveBlankToKeep') : field.placeholder}
                    value={values[field.key] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                </Field>
              );
            })}
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={t('disconnectTitle')}
        description={t('disconnectWarning')}
        confirmLabel={t('disconnect')}
        cancelLabel={tApp('cancel')}
        loading={disconnect.submitting}
        onConfirm={confirmDisconnect}
      />
    </>
  );
}
