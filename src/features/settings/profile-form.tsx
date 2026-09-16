'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { changePasswordAction, updateProfileAction } from '@/app/actions/profile';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ImageField } from '@/features/settings/image-field';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';

export interface ProfileValues {
  fullName: string;
  phone: string;
  avatarUrl: string;
  locale: 'ar' | 'en';
}

/**
 * The signed-in user's own account.
 *
 * Separate from store settings: this is the person, not the shop, and a staff
 * member with no settings permission still owns their own name and password.
 *
 * Changing the password signs every session out, including this one, so the
 * form says so before submitting rather than surprising the merchant with a
 * login screen.
 */
export function ProfileForm({
  initial,
  email,
  locale,
}: {
  initial: ProfileValues;
  email: string;
  locale: string;
}) {
  const t = useTranslations('settings.profile');
  const tAuth = useTranslations('auth');
  const tApp = useTranslations('app');
  const { toast } = useToast();
  const router = useRouter();

  const [values, setValues] = useState(initial);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const save = useServerAction(updateProfileAction);
  const password = useServerAction(changePasswordAction);

  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await save.run(values);
    if (result === null) return;

    toast({ title: t('saved'), tone: 'success' });
    // A locale change moves the whole dashboard, so land on the new path.
    if (values.locale !== locale) router.push(`/${values.locale}/dashboard/profile`);
    else router.refresh();
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await password.run({ currentPassword, newPassword, confirmPassword });
    if (result === null) return;

    toast({ title: t('passwordChanged'), tone: 'success' });
    router.push(`/${locale}/login`);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submitProfile} noValidate>
        <Card>
          <CardHeader title={t('account')} />
          <CardBody className="space-y-4">
            <FormError message={save.error} />

            <Field label={t('fullName')} required error={save.fieldError('fullName')}>
              <Input
                value={values.fullName}
                autoComplete="name"
                onChange={(event) => set('fullName', event.target.value)}
              />
            </Field>

            <Field label={tApp('email')} hint={t('emailLocked')}>
              <Input value={email} dir="ltr" disabled readOnly />
            </Field>

            <Field label={tApp('phone')} optionalLabel={tApp('optional')}>
              <Input
                type="tel"
                dir="ltr"
                value={values.phone}
                autoComplete="tel"
                onChange={(event) => set('phone', event.target.value)}
              />
            </Field>

            <ImageField
              label={t('avatar')}
              value={values.avatarUrl}
              folder="avatars"
              onChange={(url) => set('avatarUrl', url)}
            />

            <Field label={tApp('language')} hint={t('localeHint')}>
              <NativeSelect
                value={values.locale}
                onChange={(event) => set('locale', event.target.value as 'ar' | 'en')}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </NativeSelect>
            </Field>
          </CardBody>
          <CardFooter>
            <Button type="submit" variant="primary" loading={save.submitting}>
              {tApp('save')}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <form onSubmit={submitPassword} noValidate>
        <Card>
          <CardHeader title={t('changePassword')} description={t('changePasswordHint')} />
          <CardBody className="space-y-4">
            <FormError message={password.error} />

            <Field
              label={t('currentPassword')}
              required
              error={password.fieldError('currentPassword')}
            >
              <Input
                type="password"
                dir="ltr"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('newPassword')}
                required
                hint={tAuth('passwordHint')}
                error={password.fieldError('newPassword')}
              >
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>

              <Field
                label={t('confirmPassword')}
                required
                error={password.fieldError('confirmPassword')}
              >
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
            </div>
          </CardBody>
          <CardFooter>
            <Button
              type="submit"
              variant="secondary"
              loading={password.submitting}
              disabled={!currentPassword || !newPassword}
            >
              {t('changePassword')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
