'use client';

import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { adoptLogoAction, generateLogoAction } from '@/app/actions/ai';
import { updateDesignAction } from '@/app/actions/themes';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { SwitchField } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { ImageField } from '@/features/settings/image-field';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

const FONTS = ['ibm-plex-arabic', 'noto-sans-arabic', 'tajawal', 'alexandria'] as const;

const FONT_STACKS: Record<(typeof FONTS)[number], string> = {
  'ibm-plex-arabic': "'IBM Plex Sans Arabic', system-ui, sans-serif",
  'noto-sans-arabic': "'Noto Sans Arabic', system-ui, sans-serif",
  tajawal: "'Tajawal', system-ui, sans-serif",
  alexandria: "'Alexandria', system-ui, sans-serif",
};

export interface DesignValues {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: (typeof FONTS)[number];
  logoUrl: string;
  faviconUrl: string;
  announcementEnabled: boolean;
  announcementText: string;
}

/**
 * Store design.
 *
 * Brand identity only — colours, type, logo, announcement bar. Layout and
 * section composition belong to the theme, which is picked in the theme store,
 * so the two screens never disagree about who owns what.
 *
 * The preview on the side is rendered from the same values the form holds, so
 * a colour change is visible before saving. Nothing is persisted until the
 * merchant presses save.
 */
export function DesignEditor({
  initial,
  storeName,
  storeSlug,
  locale,
}: {
  initial: DesignValues;
  storeName: string;
  storeSlug: string;
  locale: string;
}) {
  const t = useTranslations('design');
  const tSettings = useTranslations('settings');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [values, setValues] = useState(initial);
  const [candidates, setCandidates] = useState<Array<{ id: string; svg: string }> | null>(null);

  const save = useServerAction(updateDesignAction);
  const generate = useServerAction(generateLogoAction);
  const adopt = useServerAction(adoptLogoAction);

  const set = <K extends keyof DesignValues>(key: K, value: DesignValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await save.run(values);
    if (result === null) return;
    toast({ title: tSettings('saved'), tone: 'success' });
  };

  const generateLogos = async () => {
    const result = await generate.run(storeName);
    if (!result) return;
    setCandidates(result.map((candidate) => ({ id: candidate.id, svg: candidate.svg })));
  };

  const chooseLogo = async (candidateId: string) => {
    const result = await adopt.run({ storeName, candidateId });
    if (!result) return;

    // The file exists now, but the store still points at the old logo until
    // the form is saved — choosing is not publishing.
    set('logoUrl', result.url);
    setCandidates(null);
    toast({ title: t('logoSaved'), tone: 'success' });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-3">
        <FormError message={save.error ?? generate.error ?? adopt.error} />

        <Card>
          <CardHeader title={t('brand')} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <ImageField
              label={tSettings('identity.logo')}
              value={values.logoUrl}
              onChange={(url) => set('logoUrl', url)}
              folder="branding"
            />
            <ImageField
              label={tSettings('identity.favicon')}
              value={values.faviconUrl}
              onChange={(url) => set('faviconUrl', url)}
              folder="branding"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('colors')} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label={t('primaryColor')}
              value={values.primaryColor}
              error={save.fieldError('primaryColor')}
              onChange={(value) => set('primaryColor', value)}
            />
            <ColorField
              label={t('secondaryColor')}
              value={values.secondaryColor}
              error={save.fieldError('secondaryColor')}
              onChange={(value) => set('secondaryColor', value)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('typography')} />
          <CardBody>
            <Field label={t('font')}>
              <NativeSelect
                value={values.fontFamily}
                onChange={(event) =>
                  set('fontFamily', event.target.value as (typeof FONTS)[number])
                }
              >
                {FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('announcementBar')} />
          <CardBody className="space-y-4">
            <SwitchField
              checked={values.announcementEnabled}
              onCheckedChange={(checked) => set('announcementEnabled', checked)}
              label={t('announcementEnabled')}
            />
            <Field
              label={t('announcementText')}
              optionalLabel={tApp('optional')}
              error={save.fieldError('announcementText')}
            >
              <Input
                value={values.announcementText}
                maxLength={200}
                disabled={!values.announcementEnabled}
                onChange={(event) => set('announcementText', event.target.value)}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('logoGenerator')} description={t('logoGeneratorHint')} />
          <CardBody className="space-y-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={generate.submitting}
              onClick={generateLogos}
            >
              <Sparkles aria-hidden />
              {t('generateLogos')}
            </Button>

            {candidates ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <div className="space-y-2 rounded-[var(--radius)] border border-border bg-surface-2 p-3">
                      {/* The markup comes from our own generator, not from the
                          merchant, and is re-rendered server-side when chosen. */}
                      <div
                        className="flex h-16 items-center justify-center overflow-hidden"
                        // eslint-disable-next-line react/no-danger -- server-generated SVG, never user input
                        dangerouslySetInnerHTML={{ __html: candidate.svg }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        block
                        loading={adopt.submitting}
                        onClick={() => chooseLogo(candidate.id)}
                      >
                        <Check aria-hidden />
                        {t('selectLogo')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-3">
          <Card>
            <CardHeader
              title={tApp('preview')}
              action={
                <a
                  href={`/${locale}/${storeSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  {tApp('open')}
                </a>
              }
            />
            <CardBody>
              <BrandPreview values={values} storeName={storeName} />
            </CardBody>
            <CardFooter>
              <Button type="submit" variant="primary" loading={save.submitting} block>
                {tApp('save')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </form>
  );
}

/**
 * Colour input.
 *
 * The native swatch and a text field edit the same value: the swatch is quick,
 * the text field is how a merchant pastes an exact brand hex. The text field
 * accepts free typing so a half-typed `#0b1` is not fought with mid-keystroke;
 * the server validates the final value.
 */
function ColorField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);

  return (
    <Field label={label} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={valid ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-[var(--radius)] border border-border bg-surface-2 p-1"
        />
        <Input
          value={value}
          dir="ltr"
          spellCheck={false}
          maxLength={7}
          onChange={(event) => onChange(event.target.value.trim())}
          className={cn('font-mono', !valid && 'border-danger')}
        />
      </div>
    </Field>
  );
}

/** A miniature of the storefront header and buy button under the current values. */
function BrandPreview({ values, storeName }: { values: DesignValues; storeName: string }) {
  const t = useTranslations('storefront');

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border border-border bg-white text-[#0f172a]"
      style={{ fontFamily: FONT_STACKS[values.fontFamily] }}
    >
      {values.announcementEnabled && values.announcementText ? (
        <p
          className="truncate px-3 py-1.5 text-center text-[11px] text-white"
          style={{ backgroundColor: values.secondaryColor }}
        >
          {values.announcementText}
        </p>
      ) : null}

      <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-3 py-2.5">
        {values.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary upload path
          <img src={values.logoUrl} alt="" className="h-7 max-w-[120px] object-contain" />
        ) : (
          <span className="text-sm font-bold">{storeName}</span>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="h-20 rounded bg-[#f1f5f9]" />
        <div className="h-2.5 w-3/4 rounded bg-[#e2e8f0]" />
        <div className="h-2.5 w-1/2 rounded bg-[#e2e8f0]" />
        <div
          className="mt-3 flex h-11 items-center justify-center rounded text-[13px] font-semibold text-white"
          style={{ backgroundColor: values.primaryColor }}
        >
          {t('buyNow')}
        </div>
      </div>
    </div>
  );
}
