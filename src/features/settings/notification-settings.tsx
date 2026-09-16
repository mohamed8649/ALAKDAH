'use client';

import { Save, Volume2 } from 'lucide-react';
import { useState } from 'react';

import { updateNotificationsAction } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { SwitchField } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';

interface NotificationValues {
  notificationsEnabled: boolean;
  notificationSound: boolean;
  notificationVolume: number;
  notifyOnNewOrder: boolean;
  notifyOnConfirmed: boolean;
  notifyOnShipped: boolean;
}

/**
 * Notification settings.
 *
 * The test-sound button is what makes the volume slider meaningful, and it is
 * also the user gesture browsers require before audio may play — so the setting
 * can be verified here rather than discovered to be silent at 2am.
 */
export function NotificationSettingsForm({
  initial,
  canManage,
}: {
  initial: NotificationValues;
  canManage: boolean;
}) {
  const t = useTranslations('settings.notifications');
  const tSettings = useTranslations('settings');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [values, setValues] = useState(initial);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const action = useServerAction(updateNotificationsAction);

  const set = <K extends keyof NotificationValues>(key: K, value: NotificationValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const testSound = () => {
    try {
      // A short synthesised beep — no audio asset to ship, and it proves the
      // browser will actually play sound for this origin.
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        setAudioBlocked(true);
        return;
      }

      const context = new AudioCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.value = 880;
      gain.gain.value = Math.min(0.2, values.notificationVolume / 500);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);

      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await action.run(values);
    if (result === null) return;
    toast({ title: tSettings('saved'), tone: 'success' });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <FormError message={action.error} />

      <Card>
        <CardHeader title={tSettings('sections.notifications')} />
        <CardBody className="space-y-4">
          <SwitchField
            checked={values.notificationsEnabled}
            onCheckedChange={(checked) => set('notificationsEnabled', checked)}
            disabled={!canManage}
            label={t('enable')}
            hint={t('enableHint')}
          />

          {values.notificationsEnabled ? (
            <>
              <SwitchField
                checked={values.notificationSound}
                onCheckedChange={(checked) => set('notificationSound', checked)}
                disabled={!canManage}
                label={t('sound')}
              />

              {values.notificationSound ? (
                <Field label={t('volume')}>
                  <div className="flex items-center gap-3">
                    <Volume2 className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={values.notificationVolume}
                      disabled={!canManage}
                      onChange={(event) => set('notificationVolume', Number(event.target.value))}
                      aria-label={t('volume')}
                      className="h-1.5 flex-1 accent-[var(--primary)]"
                    />
                    <span className="w-10 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                      {values.notificationVolume}%
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={testSound}>
                      {t('testSound')}
                    </Button>
                  </div>
                  {audioBlocked ? (
                    <p className="mt-1.5 text-xs text-warning">{t('permissionDenied')}</p>
                  ) : null}
                </Field>
              ) : null}

              <div className="space-y-2.5 border-t border-border pt-3">
                <p className="text-[13px] font-medium text-foreground">{t('events')}</p>
                <SwitchField
                  checked={values.notifyOnNewOrder}
                  onCheckedChange={(checked) => set('notifyOnNewOrder', checked)}
                  disabled={!canManage}
                  label={t('newOrder')}
                />
                <SwitchField
                  checked={values.notifyOnConfirmed}
                  onCheckedChange={(checked) => set('notifyOnConfirmed', checked)}
                  disabled={!canManage}
                  label={t('orderConfirmed')}
                />
                <SwitchField
                  checked={values.notifyOnShipped}
                  onCheckedChange={(checked) => set('notifyOnShipped', checked)}
                  disabled={!canManage}
                  label={t('shippingUpdate')}
                />
              </div>
            </>
          ) : null}

          {canManage ? (
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" loading={action.submitting}>
                <Save aria-hidden />
                {tApp('saveChanges')}
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </form>
  );
}
