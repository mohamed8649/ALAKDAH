'use client';

import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { generateLandingPageAction } from '@/app/actions/ai';
import { savePageAction } from '@/app/actions/pages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, NativeSelect, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { BlockRenderer } from '@/features/pages/block-renderer';
import type { PageBlock } from '@/features/pages/blocks';
import { useServerAction } from '@/hooks/use-server-action';
import { useLocale, useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

const FRAMEWORKS = ['AIDA', 'PAS', 'STORY_BRAND', 'PROOF_STACK', 'OBJECTION_CRUSHER', 'BAB'] as const;

const PRESETS = [
  'tech_neon',
  'luxury_black_gold',
  'outdoor_orange',
  'home_lifestyle',
  'clean_aqua',
  'streetwear_dark',
  'beauty_soft',
  'pro_tool',
  'kids_family',
  'offer_blast',
] as const;

/**
 * AI landing page generator.
 *
 * Generate → review → save as draft. Nothing is published, and nothing is even
 * persisted, until the merchant chooses to save — the generated blocks land in
 * the same builder they would have used by hand.
 */
export function AiPageGenerator({
  products,
  badges,
  currency,
  locale,
}: {
  products: Array<{ id: string; name: string; slug: string; price: number; imageUrl: string | null }>;
  badges: Array<{ id: string; title: string; description: string | null; icon: string }>;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('pages.ai');
  const tApp = useTranslations('app');
  const tProducts = useTranslations('products.ai');
  const currentLocale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [framework, setFramework] = useState<(typeof FRAMEWORKS)[number]>('AIDA');
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>('clean_aqua');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [contentLanguage, setContentLanguage] = useState(locale);
  const [instructions, setInstructions] = useState('');

  const [result, setResult] = useState<{ title: string; blocks: PageBlock[] } | null>(null);

  const generate = useServerAction(generateLandingPageAction);
  const save = useServerAction(async (input: unknown) => savePageAction(null, input));

  const run = async () => {
    const response = await generate.run({
      productId,
      language: contentLanguage,
      framework,
      preset,
      tone,
      length,
      instructions: instructions.trim() || null,
    });

    if (!response) return;
    setResult({ title: response.title, blocks: response.blocks as PageBlock[] });
  };

  const saveDraft = async () => {
    if (!result) return;

    const response = await save.run({
      title: result.title,
      document: { version: 1, blocks: result.blocks },
      productId: productId || null,
      status: 'DRAFT',
      generatedByAi: true,
      aiPreset: preset,
    });

    if (!response) return;

    toast({ title: t('saveAsDraft'), tone: 'success' });
    router.replace(`/${locale}/dashboard/pages/${response.id}`);
  };

  const renderContext = {
    currency,
    locale: currentLocale,
    badges,
    products: Object.fromEntries(products.map((product) => [product.id, product])),
  };

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        <Card>
          <CardHeader title={t('title')} />
          <CardBody className="space-y-4">
            <FormError message={generate.error ?? save.error} />

            <Field label={t('product')} required error={generate.fieldError('productId')}>
              <NativeSelect value={productId} onChange={(event) => setProductId(event.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label={t('framework')}>
              <NativeSelect
                value={framework}
                onChange={(event) =>
                  setFramework(event.target.value as (typeof FRAMEWORKS)[number])
                }
              >
                {FRAMEWORKS.map((option) => (
                  <option key={option} value={option}>
                    {t(`frameworks.${option}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label={t('preset')}>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={preset === option}
                    onClick={() => setPreset(option)}
                    className={cn(
                      'rounded-[var(--radius)] border px-2.5 py-2 text-start text-xs transition-colors duration-fast',
                      preset === option
                        ? 'border-primary bg-[var(--primary-soft)] font-medium text-primary'
                        : 'border-border text-muted-foreground hover:border-border-strong',
                    )}
                  >
                    {t(`presets.${option}`)}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('tone')}>
                <NativeSelect value={tone} onChange={(event) => setTone(event.target.value)}>
                  <option value="professional">{tProducts('tones.professional')}</option>
                  <option value="friendly">{tProducts('tones.friendly')}</option>
                  <option value="luxury">{tProducts('tones.luxury')}</option>
                  <option value="energetic">{tProducts('tones.energetic')}</option>
                  <option value="simple">{tProducts('tones.simple')}</option>
                </NativeSelect>
              </Field>

              <Field label={t('length')}>
                <NativeSelect value={length} onChange={(event) => setLength(event.target.value)}>
                  <option value="short">{tProducts('lengths.short')}</option>
                  <option value="medium">{tProducts('lengths.medium')}</option>
                  <option value="long">{tProducts('lengths.long')}</option>
                </NativeSelect>
              </Field>
            </div>

            <Field label={t('language')}>
              <NativeSelect
                value={contentLanguage}
                onChange={(event) => setContentLanguage(event.target.value)}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </NativeSelect>
            </Field>

            <Field label={t('instructions')} optionalLabel={tApp('optional')}>
              <Textarea
                value={instructions}
                rows={3}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </Field>

            <Button
              variant="primary"
              block
              loading={generate.submitting}
              disabled={!productId}
              onClick={run}
            >
              <Sparkles aria-hidden />
              {generate.submitting ? t('generating') : t('generate')}
            </Button>
          </CardBody>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <Card>
          <CardHeader
            title={t('review')}
            description={t('reviewHint')}
            action={
              result ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" loading={generate.submitting} onClick={run}>
                    {t('regenerate')}
                  </Button>
                  <Button variant="primary" size="sm" loading={save.submitting} onClick={saveDraft}>
                    {t('saveAsDraft')}
                  </Button>
                </div>
              ) : null
            }
          />
          <CardBody className="bg-surface-2">
            {result ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="accent">AI</Badge>
                  <Badge tone="outline">{t(`frameworks.${framework}`)}</Badge>
                  <Badge tone="outline">{t(`presets.${preset}`)}</Badge>
                  <Badge tone="outline">{result.blocks.length}</Badge>
                </div>

                <div className="storefront-scope overflow-hidden rounded-[var(--radius-lg)] border border-border bg-background">
                  {result.blocks.map((block) => (
                    <BlockRenderer key={block.id} block={block} context={renderContext} />
                  ))}
                </div>
              </>
            ) : (
              <p className="py-16 text-center text-xs text-subtle-foreground">{t('reviewHint')}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
