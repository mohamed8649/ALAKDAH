'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { loginAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { loginSchema, type LoginInput } from '@/validators/auth';

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const tValidation = useTranslations();
  const { run, submitting, error, fieldError } = useServerAction((values: LoginInput) =>
    loginAction(values, locale),
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // On success the action redirects server-side and never returns, so there is
  // nothing to do here but let the error states render.
  const onSubmit = form.handleSubmit(async (values) => {
    await run(values);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={error} />

      <Field
        label={t('email')}
        required
        error={form.formState.errors.email ? tValidation(form.formState.errors.email.message ?? '') : fieldError('email')}
      >
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          placeholder="you@example.com"
          {...form.register('email')}
        />
      </Field>

      <Field
        label={t('password')}
        required
        error={
          form.formState.errors.password
            ? tValidation(form.formState.errors.password.message ?? '')
            : fieldError('password')
        }
      >
        <Input type="password" autoComplete="current-password" {...form.register('password')} />
      </Field>

      <Button type="submit" variant="primary" size="touch" block loading={submitting}>
        {submitting ? t('loggingIn') : t('submit')}
      </Button>
    </form>
  );
}
