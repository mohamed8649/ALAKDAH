'use client';

import { CheckCircle2, Plug, XCircle } from 'lucide-react';
import { useState } from 'react';

import {
  connectProviderAction,
  disconnectProviderAction,
  testProviderAction,
} from '@/app/actions/shipping';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { Icon } from '@/components/layout/icon';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatRelative } from '@/lib/datetime';

interface CredentialField {
  key: 'apiKey' | 'apiSecret' | 'accountId' | 'baseUrl';
  labelAr: string;
  secret: boolean;
}

export interface ProviderCardRow {
  id: string | null;
  providerKey: string;
  name: string;
  descriptionAr: string;
  logo: string;
  isConnected: boolean;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  credentialFields: CredentialField[];
}

/**
 * Carrier connections.
 *
 * Credentials are written once and never read back: after saving, the merchant
 * sees connection state and a test result, not the secret. Re-entering the
 * credentials is the only way to change them, which is the correct trade-off
 * for a value that must not round-trip through a browser.
 */
export function ShippingProvidersManager({
  providers,
  canManage,
}: {
  providers: ProviderCardRow[];
  canManage: boolean;
}) {
  const t = useTranslations('shipping');
  const tApp = useTranslations('app');
  const locale = useLocale();
  const { toast } = useToast();

  const [connecting, setConnecting] = useState<ProviderCardRow | null>(null);
  const [disconnecting, setDisconnecting] = useState<ProviderCardRow | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const disconnect = useServerAction(disconnectProviderAction);

  const runTest = async (provider: ProviderCardRow) => {
    if (!provider.id) return;
    setTestingKey(provider.providerKey);

    const response = await testProviderAction(provider.id);
    setTestingKey(null);

    if (!response.ok) {
      toast({ title: t('testFailed'), tone: 'error' });
      return;
    }

    toast({
      title: response.data.ok ? t('testSuccess') : t('testFailed'),
      description: response.data.message,
      tone: response.data.ok ? 'success' : 'error',
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-subtle-foreground">{t('credentialsHidden')}</p>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => (
          <li key={provider.providerKey}>
            <Card className="h-full">
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-surface-3 text-muted-foreground">
                    <Icon name={provider.logo} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {provider.name}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {provider.descriptionAr}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={provider.isConnected ? 'success' : 'neutral'} dot>
                    {provider.isConnected ? t('connected') : t('notConnected')}
                  </Badge>
                  {provider.lastTestedAt ? (
                    <Badge
                      tone={provider.lastTestStatus === 'ok' ? 'success' : 'danger'}
                      icon={
                        provider.lastTestStatus === 'ok' ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <XCircle className="size-3" />
                        )
                      }
                    >
                      {formatRelative(provider.lastTestedAt, locale)}
                    </Badge>
                  ) : null}
                </div>

                {provider.lastTestMessage ? (
                  <p className="rounded-[var(--radius-sm)] bg-surface-2 px-2 py-1.5 text-2xs leading-relaxed text-muted-foreground">
                    {provider.lastTestMessage}
                  </p>
                ) : null}

                {canManage ? (
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button
                      variant={provider.isConnected ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => setConnecting(provider)}
                    >
                      <Plug aria-hidden />
                      {provider.isConnected ? t('reconnect') : t('connect')}
                    </Button>

                    {provider.isConnected ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={testingKey === provider.providerKey}
                          onClick={() => runTest(provider)}
                        >
                          {testingKey === provider.providerKey ? t('testing') : t('testConnection')}
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() => setDisconnecting(provider)}
                        >
                          {t('disconnect')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <ConnectDialog
        provider={connecting}
        onOpenChange={(open) => !open && setConnecting(null)}
        onSaved={() => setConnecting(null)}
      />

      <ConfirmDialog
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={t('disconnect')}
        description={t('disconnectWarning')}
        confirmLabel={t('disconnect')}
        cancelLabel={tApp('cancel')}
        loading={disconnect.submitting}
        onConfirm={async () => {
          if (!disconnecting?.id) return;
          const result = await disconnect.run(disconnecting.id);
          setDisconnecting(null);
          if (result !== null) toast({ title: t('disconnect'), tone: 'success' });
          else if (disconnect.error) toast({ title: disconnect.error, tone: 'error' });
        }}
      />
    </div>
  );
}

function ConnectDialog({
  provider,
  onOpenChange,
  onSaved,
}: {
  provider: ProviderCardRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations('shipping');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (provider && provider.providerKey !== seededFor) {
    setSeededFor(provider.providerKey);
    setName(provider.name);
    setValues({});
  }

  const action = useServerAction(connectProviderAction);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!provider) return;

    const result = await action.run({
      providerKey: provider.providerKey,
      name,
      apiKey: values.apiKey ?? '',
      apiSecret: values.apiSecret ?? '',
      accountId: values.accountId ?? '',
      baseUrl: values.baseUrl ?? '',
    });

    if (result === null) return;
    toast({ title: t('connected'), tone: 'success' });
    onSaved();
  };

  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      <DialogContent
        title={provider?.name ?? ''}
        description={t('credentialsHidden')}
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
              {t('connect')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={action.error} />

          <Field label={t('providerFields.name')} required error={action.fieldError('name')}>
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>

          {(provider?.credentialFields ?? []).map((field) => (
            <Field key={field.key} label={field.labelAr} error={action.fieldError(field.key)}>
              <Input
                type={field.secret ? 'password' : 'text'}
                dir="ltr"
                autoComplete="off"
                value={values[field.key] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            </Field>
          ))}

          {provider?.credentialFields.length === 0 ? (
            <p className="text-xs text-muted-foreground">{provider.descriptionAr}</p>
          ) : null}

          <button type="submit" className="sr-only">
            {t('connect')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
