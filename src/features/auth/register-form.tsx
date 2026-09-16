'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { registerAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { slugify } from '@/lib/slug';
import { registerSchema, type RegisterInput } from '@/validators/auth';

export function RegisterForm({ locale, appUrl }: { locale: string; appUrl: string }) {
  const t = useTranslations('auth');
  const tValidation = useTranslations();
  const { run, submitting, error, fieldError } = useServerAction((values: RegisterInput) =>
    registerAction(values, locale),
  );

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      storeName: '',
      storeSlug: '',
    },
  });

  const storeName = form.watch('storeName');
  const slugTouched = form.formState.dirtyFields.storeSlug;

  // Suggest a URL from the store name until the merchant edits it themselves.
  useEffect(() => {
    if (!slugTouched && storeName) {
      form.setValue('storeSlug', slugify(storeName, 'store'), { shouldValidate: false });
    }
  }, [storeName, slugTouched, form]);

  // The action redirects server-side on success; see the note in auth actions.
  const onSubmit = form.handleSubmit(async (values) => {
    await run(values);
  });

  const errorFor = (name: keyof RegisterInput) => {
    const clientMessage = form.formState.errors[name]?.message;
    return clientMessage ? tValidation(clientMessage) : fieldError(name);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={error} />

      <Field label={t('fullName')} required error={errorFor('fullName')}>
        <Input autoComplete="name" {...form.register('fullName')} />
      </Field>

      <Field label={t('email')} required error={errorFor('email')}>
        <Input type="email" dir="ltr" inputMode="email" autoComplete="email" {...form.register('email')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('password')} required error={errorFor('password')}>
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label={t('confirmPassword')} required error={errorFor('confirmPassword')}>
          <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
        </Field>
      </div>

      <Field label={t('storeName')} required error={errorFor('storeName')}>
        <Input {...form.register('storeName')} />
      </Field>

      <Field label={t('storeSlug')} required error={errorFor('storeSlug')} hint={`${appUrl}/…`}>
        <Input dir="ltr" adornStart={`${appUrl.replace(/^https?:\/\//, '')}/`} {...form.register('storeSlug')} />
      </Field>

      <Button type="submit" variant="primary" size="touch" block loading={submitting}>
        {t('createAccount')}
      </Button>
    </form>
  );
}
