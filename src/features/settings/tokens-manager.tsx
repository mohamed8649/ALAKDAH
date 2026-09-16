'use client';

import { AlertTriangle, Copy, KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';

import { createTokenAction, revokeTokenAction } from '@/app/actions/tokens';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { CheckboxField } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { formatDate, formatRelative } from '@/lib/datetime';

interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * Access tokens.
 *
 * A created token is shown once, in a dialog that says so plainly and cannot be
 * reopened. The list afterwards shows only the prefix.
 */
export function TokensManager({
  tokens,
  availableScopes,
  locale,
  canManage,
}: {
  tokens: TokenRow[];
  availableScopes: string[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations('settings.tokens');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<TokenRow | null>(null);
  const [created, setCreated] = useState<{ plaintext: string; prefix: string } | null>(null);

  const revoke = useServerAction(revokeTokenAction);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: tApp('copied'), tone: 'success' });
    } catch {
      toast({ title: tApp('copy'), description: value, tone: 'info', durationMs: 15_000 });
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader
          title={t('title')}
          description={t('hint')}
          action={
            canManage ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {t('create')}
              </Button>
            ) : null
          }
        />

        {tokens.length === 0 ? (
          <EmptyState icon={<KeyRound />} title={t('empty')} description={t('hint')} />
        ) : (
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {tokens.map((token) => (
                <li key={token.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{token.name}</p>
                    <p className="truncate font-mono text-2xs text-subtle-foreground" dir="ltr">
                      {token.prefix}••••
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {token.revokedAt ? (
                      <Badge tone="danger">{t('revoked')}</Badge>
                    ) : token.expiresAt && new Date(token.expiresAt) < new Date() ? (
                      <Badge tone="warning">{t('expiresAt')}</Badge>
                    ) : (
                      <Badge tone="success" dot>
                        {tApp('active')}
                      </Badge>
                    )}

                    <Badge tone="outline">{token.scopes.length}</Badge>

                    <span className="text-2xs text-subtle-foreground">
                      {token.lastUsedAt
                        ? formatRelative(token.lastUsedAt, locale)
                        : t('neverUsed')}
                    </span>

                    {canManage && !token.revokedAt ? (
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        onClick={() => setRevoking(token)}
                      >
                        {t('revoke')}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        )}
      </Card>

      <CreateTokenDialog
        open={creating}
        onOpenChange={setCreating}
        availableScopes={availableScopes}
        onCreated={(value) => {
          setCreating(false);
          setCreated(value);
        }}
      />

      {/* One-time reveal. Closing it is irreversible, and the copy says so. */}
      <Dialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent
          title={t('createdTitle')}
          footer={
            <Button variant="primary" onClick={() => setCreated(null)}>
              {tApp('close')}
            </Button>
          }
        >
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2.5 text-[13px] text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('createdWarning')}
            </p>

            <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-surface-2 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground" dir="ltr">
                {created?.plaintext}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => created && copy(created.plaintext)}
              >
                <Copy aria-hidden />
                {tApp('copy')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t('revoke')}
        description={t('revokeWarning')}
        confirmLabel={t('revoke')}
        cancelLabel={tApp('cancel')}
        loading={revoke.submitting}
        onConfirm={async () => {
          if (!revoking) return;
          const result = await revoke.run(revoking.id);
          setRevoking(null);
          if (result !== null) toast({ title: t('revoked'), tone: 'success' });
          else if (revoke.error) toast({ title: revoke.error, tone: 'error' });
        }}
      />
    </div>
  );
}

function CreateTokenDialog({
  open,
  onOpenChange,
  availableScopes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableScopes: string[];
  onCreated: (value: { plaintext: string; prefix: string }) => void;
}) {
  const t = useTranslations('settings.tokens');
  const tApp = useTranslations('app');

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState('0');

  const action = useServerAction(createTokenAction);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await action.run({ name, scopes, expiresInDays });
    if (!result) return;

    setName('');
    setScopes([]);
    onCreated({ plaintext: result.plaintext, prefix: result.prefix });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={t('create')}
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
              {tApp('create')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={action.error} />

          <Field label={t('tokenName')} required error={action.fieldError('name')}>
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>

          <Field label={t('expiresAt')}>
            <NativeSelect
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
            >
              <option value="0">{t('neverExpires')}</option>
              <option value="30">30</option>
              <option value="90">90</option>
              <option value="365">365</option>
            </NativeSelect>
          </Field>

          <Field label={t('scopes')} required error={action.fieldError('scopes')}>
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-[var(--radius)] border border-border p-3">
              {availableScopes.map((scope) => (
                <CheckboxField
                  key={scope}
                  checked={scopes.includes(scope)}
                  onCheckedChange={(checked) =>
                    setScopes((current) =>
                      checked ? [...current, scope] : current.filter((entry) => entry !== scope),
                    )
                  }
                  label={<span className="font-mono text-xs">{scope}</span>}
                />
              ))}
            </div>
          </Field>

          <button type="submit" className="sr-only">
            {tApp('create')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
