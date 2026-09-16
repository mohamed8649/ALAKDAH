'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { agentLoginAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';

/**
 * Agent sign-in.
 *
 * The failure message is deliberately identical for a wrong store, a wrong
 * username and a wrong password — anything more specific would let someone
 * enumerate which agents exist in a store.
 */
export function AgentLoginForm({
  locale,
  defaultStore,
}: {
  locale: string;
  defaultStore: string;
}) {
  const t = useTranslations('auth');
  const router = useRouter();

  const [storeIdentifier, setStoreIdentifier] = useState(defaultStore);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const { run, submitting, error, fieldError } = useServerAction(agentLoginAction);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await run({ storeIdentifier, username, password });
    if (result) {
      router.replace(`/${locale}${result.redirectTo}`);
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormError message={error} />

      <Field label={t('storeIdentifier')} required error={fieldError('storeIdentifier')}>
        <Input
          value={storeIdentifier}
          onChange={(event) => setStoreIdentifier(event.target.value)}
          dir="ltr"
          autoComplete="organization"
          autoFocus={!defaultStore}
        />
      </Field>

      <Field label={t('username')} required error={fieldError('username')}>
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          dir="ltr"
          autoComplete="username"
          autoFocus={Boolean(defaultStore)}
        />
      </Field>

      <Field label={t('password')} required error={fieldError('password')}>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </Field>

      <Button type="submit" variant="primary" size="touch" block loading={submitting}>
        {submitting ? t('loggingIn') : t('submit')}
      </Button>
    </form>
  );
}
