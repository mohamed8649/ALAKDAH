'use client';

import { ArrowDown, ArrowUp, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { saveTrustBadgesAction } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { SwitchField } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { TrustBadgeRow } from '@/features/storefront/trust-badges';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';

const ICONS = [
  'shield',
  'truck',
  'refresh',
  'award',
  'lock',
  'headphones',
  'clock',
  'check',
] as const;

export interface BadgeDraft {
  title: string;
  description: string | null;
  icon: string;
  isActive: boolean;
}

const MAX_BADGES = 6;

/**
 * Trust badges.
 *
 * Order is part of the content — the first badge is the one a customer on a
 * 360px screen actually reads — so it is editable here rather than being
 * whatever order the rows were created in. The preview underneath is the same
 * component the storefront renders.
 */
export function TrustBadgesEditor({ initial }: { initial: BadgeDraft[] }) {
  const t = useTranslations('trustBadges');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [badges, setBadges] = useState<BadgeDraft[]>(initial);
  const save = useServerAction(saveTrustBadgesAction);

  const update = (index: number, patch: Partial<BadgeDraft>) =>
    setBadges((current) =>
      current.map((badge, position) => (position === index ? { ...badge, ...patch } : badge)),
    );

  const move = (index: number, delta: number) =>
    setBadges((current) => {
      const next = [...current];
      const target = index + delta;
      const moved = next[index];
      const swapped = next[target];
      if (!moved || !swapped) return current;

      next[index] = swapped;
      next[target] = moved;
      return next;
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await save.run(
      badges
        .filter((badge) => badge.title.trim().length > 0)
        .map((badge) => ({
          title: badge.title.trim(),
          description: badge.description?.trim() || null,
          icon: badge.icon,
          isActive: badge.isActive,
        })),
    );
    if (result === null) return;

    toast({ title: tApp('save'), tone: 'success' });
  };

  const active = badges.filter((badge) => badge.isActive && badge.title.trim().length > 0);

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Card>
        <CardHeader
          title={t('title')}
          description={t('subtitle')}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={badges.length >= MAX_BADGES}
              onClick={() =>
                setBadges((current) => [
                  ...current,
                  { title: '', description: null, icon: 'shield', isActive: true },
                ])
              }
            >
              <Plus aria-hidden />
              {t('add')}
            </Button>
          }
        />
        <CardBody className="space-y-3">
          <FormError message={save.error} />

          {badges.length === 0 ? (
            <EmptyState icon={<ShieldCheck />} title={t('empty')} compact />
          ) : (
            <ul className="space-y-3">
              {badges.map((badge, index) => (
                <li
                  key={index}
                  className="space-y-3 rounded-[var(--radius)] border border-border p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 gap-3 sm:grid-cols-[auto_1fr]">
                      <Field label={t('icon')}>
                        <NativeSelect
                          value={badge.icon}
                          onChange={(event) => update(index, { icon: event.target.value })}
                        >
                          {ICONS.map((icon) => (
                            <option key={icon} value={icon}>
                              {t(`icons.${icon}`)}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>

                      <Field label={t('badgeTitle')} required>
                        <Input
                          value={badge.title}
                          maxLength={60}
                          onChange={(event) => update(index, { title: event.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1 pt-6">
                      <IconButton
                        label={tApp('previous')}
                        icon={<ArrowUp />}
                        size="sm"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      />
                      <IconButton
                        label={tApp('next')}
                        icon={<ArrowDown />}
                        size="sm"
                        variant="ghost"
                        disabled={index === badges.length - 1}
                        onClick={() => move(index, 1)}
                      />
                      <IconButton
                        label={tApp('remove')}
                        icon={<Trash2 />}
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setBadges((current) =>
                            current.filter((_, position) => position !== index),
                          )
                        }
                      />
                    </div>
                  </div>

                  <Field label={t('badgeDescription')} optionalLabel={tApp('optional')}>
                    <Input
                      value={badge.description ?? ''}
                      maxLength={120}
                      onChange={(event) => update(index, { description: event.target.value })}
                    />
                  </Field>

                  <SwitchField
                    checked={badge.isActive}
                    onCheckedChange={(checked) => update(index, { isActive: checked })}
                    label={tApp('active')}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
        <CardFooter>
          <Button type="submit" variant="primary" loading={save.submitting}>
            {tApp('save')}
          </Button>
        </CardFooter>
      </Card>

      {active.length > 0 ? (
        <Card>
          <CardHeader title={tApp('preview')} />
          <CardBody className="storefront-scope bg-background">
            <TrustBadgeRow
              badges={active.map((badge, index) => ({
                id: `preview-${index}`,
                title: badge.title,
                description: badge.description,
                icon: badge.icon,
              }))}
            />
          </CardBody>
        </Card>
      ) : null}
    </form>
  );
}
