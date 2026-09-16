'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { generateDescriptionAction } from '@/app/actions/ai';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, NativeSelect, Textarea } from '@/components/ui/field';
import { FormError } from '@/features/shared/form-error';
import { useServerAction } from '@/hooks/use-server-action';
import { useLocale, useTranslations } from '@/i18n/provider';

/**
 * AI product description.
 *
 * The flow is IDLE → GENERATING → GENERATED → EDITED → SAVED. Generated text is
 * never written to the product automatically: it lands in an editable textarea,
 * and only "use this text" hands it back to the form. A failed generation
 * offers a retry rather than an empty box.
 */

type Phase = 'idle' | 'generating' | 'generated';

export function AiDescriptionButton({
  productName,
  features,
  onAccept,
  disabled,
}: {
  productName: string;
  features: string;
  onAccept: (text: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('products.ai');
  const tApp = useTranslations('app');
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [draft, setDraft] = useState('');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [instructions, setInstructions] = useState('');
  const { run, submitting, error } = useServerAction(generateDescriptionAction);

  const generate = async () => {
    setPhase('generating');
    const result = await run({
      productName,
      features: features
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      tone,
      length,
      language: locale,
      instructions: instructions.trim() || null,
    });

    if (result) {
      setDraft(result.text);
      setPhase('generated');
    } else {
      setPhase('idle');
    }
  };

  const close = () => {
    setOpen(false);
    setPhase('idle');
    setDraft('');
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !productName.trim()}
        onClick={() => setOpen(true)}
        title={!productName.trim() ? t('title') : undefined}
      >
        <Sparkles aria-hidden />
        {t('generate')}
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent
          size="lg"
          title={t('title')}
          description={t('description')}
          footer={
            phase === 'generated' ? (
              <>
                <Button variant="ghost" onClick={close}>
                  {t('discard')}
                </Button>
                <Button variant="secondary" onClick={generate} loading={submitting}>
                  {t('regenerate')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onAccept(draft);
                    close();
                  }}
                >
                  {t('useText')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={close}>
                  {tApp('cancel')}
                </Button>
                <Button variant="primary" onClick={generate} loading={submitting}>
                  <Sparkles aria-hidden />
                  {submitting ? t('generating') : t('generate')}
                </Button>
              </>
            )
          }
        >
          <div className="space-y-4">
            <FormError message={error} />

            {phase === 'generated' ? (
              <>
                <p className="text-xs text-subtle-foreground">{t('editBeforeSave')}</p>
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={14}
                  aria-label={t('title')}
                />
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('tone')}>
                    <NativeSelect value={tone} onChange={(event) => setTone(event.target.value)}>
                      <option value="professional">{t('tones.professional')}</option>
                      <option value="friendly">{t('tones.friendly')}</option>
                      <option value="luxury">{t('tones.luxury')}</option>
                      <option value="energetic">{t('tones.energetic')}</option>
                      <option value="simple">{t('tones.simple')}</option>
                    </NativeSelect>
                  </Field>

                  <Field label={t('length')}>
                    <NativeSelect value={length} onChange={(event) => setLength(event.target.value)}>
                      <option value="short">{t('lengths.short')}</option>
                      <option value="medium">{t('lengths.medium')}</option>
                      <option value="long">{t('lengths.long')}</option>
                    </NativeSelect>
                  </Field>
                </div>

                <Field
                  label={t('instructions')}
                  optionalLabel={tApp('optional')}
                  hint={features.trim() ? undefined : t('featuresPlaceholder')}
                >
                  <Textarea
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    rows={3}
                  />
                </Field>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
