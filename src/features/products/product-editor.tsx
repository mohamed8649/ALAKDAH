'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createProductAction, updateProductAction } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, Section } from '@/components/ui/card';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { SwitchField, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/features/shared/form-error';
import { TagInput } from '@/features/shared/tag-input';
import { useServerAction } from '@/hooks/use-server-action';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useLocale, useTranslations } from '@/i18n/provider';
import { toDecimalString } from '@/lib/money';
import { slugify } from '@/lib/slug';

import { AiDescriptionButton } from './ai-description';
import { MediaUploader, type MediaItem } from './media-uploader';
import { OptionEditor, type OptionDraft } from './option-editor';
import { RelatedProductsPicker, type RelatedProduct } from './related-picker';
import { VariantEditor, type VariantDraft } from './variant-editor';

/**
 * Product editor.
 *
 * Deliberately not one giant form object: the editor holds a small number of
 * independent pieces of state (scalars, media, options, variants), each owned
 * by the component that edits it. That keeps a keystroke in the price field
 * from re-rendering a 40-row variant table.
 *
 * Money is edited as a decimal string and converted to minor units by the
 * validator on submit — the browser never does arithmetic on a price.
 */

export interface ProductEditorInitial {
  id: string | null;
  name: string;
  nameEn: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  visibility: 'VISIBLE' | 'HIDDEN';
  price: string;
  compareAtPrice: string;
  cost: string;
  trackInventory: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
  allowBackorder: boolean;
  weightGrams: string;
  shippingRequired: boolean;
  freeShipping: boolean;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  images: MediaItem[];
  options: OptionDraft[];
  variants: VariantDraft[];
  related: RelatedProduct[];
}

export function ProductEditor({
  initial,
  locale,
  currency,
  canDelete,
}: {
  initial: ProductEditorInitial;
  locale: string;
  currency: string;
  canDelete: boolean;
}) {
  const t = useTranslations('products');
  const tApp = useTranslations('app');
  const tStorefront = useTranslations('storefront');
  const router = useRouter();
  const { toast } = useToast();
  const currentLocale = useLocale();

  const [values, setValues] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));

  const isNew = initial.id === null;
  const action = useServerAction(
    useCallback(
      (input: unknown) =>
        isNew ? createProductAction(input) : updateProductAction(initial.id!, input),
      [initial.id, isNew],
    ),
  );

  useUnsavedChanges(dirty && !action.submitting);

  const set = useCallback(<K extends keyof ProductEditorInitial>(key: K, value: ProductEditorInitial[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }, []);

  // Suggest a URL handle from the name until the merchant edits it themselves.
  useEffect(() => {
    if (!slugTouched && values.name) {
      setValues((current) => ({ ...current, slug: slugify(current.name, 'product') }));
    }
  }, [values.name, slugTouched]);

  const payload = useMemo(
    () => ({
      name: values.name,
      nameEn: values.nameEn || null,
      slug: values.slug,
      sku: values.sku || null,
      description: values.description || null,
      shortDescription: values.shortDescription || null,
      status: values.status,
      visibility: values.visibility,
      price: values.price,
      compareAtPrice: values.compareAtPrice || null,
      cost: values.cost || null,
      trackInventory: values.trackInventory,
      stockQuantity: values.stockQuantity || '0',
      lowStockThreshold: values.lowStockThreshold || '5',
      allowBackorder: values.allowBackorder,
      weightGrams: values.weightGrams || null,
      shippingRequired: values.shippingRequired,
      freeShipping: values.freeShipping,
      upsellEnabled: false,
      seoTitle: values.seoTitle || null,
      seoDescription: values.seoDescription || null,
      tags: values.tags,
      categoryIds: [],
      collectionIds: [],
      relatedProductIds: values.related.map((product) => product.id),
      images: values.images.map((image, index) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        position: index,
        isPrimary: index === 0,
      })),
      options: values.options
        .filter((option) => option.name.trim() && option.values.length > 0)
        .map((option, index) => ({
          id: option.id.startsWith('tmp_') ? undefined : option.id,
          name: option.name,
          position: index,
          values: option.values.map((value, valueIndex) => ({
            id: value.id.startsWith('tmp_') ? undefined : value.id,
            value: value.value,
            position: valueIndex,
          })),
        })),
      variants: values.variants.map((variant) => ({
        signature: variant.signature,
        title: variant.title,
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        price: variant.price || null,
        stockQuantity: variant.stockQuantity || '0',
        isActive: variant.isActive,
        optionValueIds: variant.optionValueIds,
      })),
      offers: [],
    }),
    [values],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await action.run(payload);
    if (!result) return;

    setDirty(false);
    toast({ title: isNew ? t('created') : t('updated'), tone: 'success' });

    if (isNew) {
      router.replace(`/${locale}/dashboard/products/${result.id}/edit`);
    }
    router.refresh();
  };

  const hasVariants = values.options.some(
    (option) => option.name.trim() && option.values.length > 0,
  );

  return (
    <form onSubmit={submit} noValidate>
      <FormError message={action.error} />

      <Tabs defaultValue="basic" className="mt-3">
        <TabsList>
          <TabsTrigger value="basic">{t('sections.basic')}</TabsTrigger>
          <TabsTrigger value="media">{t('sections.media')}</TabsTrigger>
          <TabsTrigger value="options">{t('sections.variants')}</TabsTrigger>
          <TabsTrigger value="inventory">{t('sections.inventory')}</TabsTrigger>
          <TabsTrigger value="related">{t('sections.related')}</TabsTrigger>
          <TabsTrigger value="seo">{t('sections.seo')}</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4 space-y-3">
          <Card>
            <CardHeader title={t('sections.basic')} />
            <CardBody className="space-y-4">
              <Field label={t('fields.name')} required error={action.fieldError('name')}>
                <Input
                  value={values.name}
                  onChange={(event) => set('name', event.target.value)}
                  autoFocus={isNew}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('fields.slug')} error={action.fieldError('slug')} hint={`/${values.slug || '…'}`}>
                  <Input
                    value={values.slug}
                    dir="ltr"
                    onChange={(event) => {
                      setSlugTouched(true);
                      set('slug', event.target.value);
                    }}
                  />
                </Field>

                <Field label={t('fields.sku')} optionalLabel={tApp('optional')} error={action.fieldError('sku')}>
                  <Input value={values.sku} dir="ltr" onChange={(event) => set('sku', event.target.value)} />
                </Field>
              </div>

              <Field label={t('fields.shortDescription')} optionalLabel={tApp('optional')}>
                <Textarea
                  value={values.shortDescription}
                  onChange={(event) => set('shortDescription', event.target.value)}
                  rows={2}
                />
              </Field>

              <Field
                label={
                  <span className="flex items-center justify-between gap-2">
                    {t('fields.description')}
                    <AiDescriptionButton
                      productName={values.name}
                      features={values.shortDescription}
                      onAccept={(text) => set('description', text)}
                    />
                  </span>
                }
                optionalLabel={tApp('optional')}
              >
                <Textarea
                  value={values.description}
                  onChange={(event) => set('description', event.target.value)}
                  rows={8}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('sections.pricing')} />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Field label={t('fields.price')} required error={action.fieldError('price')}>
                <Input
                  value={values.price}
                  onChange={(event) => set('price', event.target.value)}
                  inputMode="decimal"
                  adornEnd={currency}
                  placeholder={toDecimalString(0, currency)}
                />
              </Field>

              <Field
                label={t('fields.compareAtPrice')}
                optionalLabel={tApp('optional')}
                error={action.fieldError('compareAtPrice')}
              >
                <Input
                  value={values.compareAtPrice}
                  onChange={(event) => set('compareAtPrice', event.target.value)}
                  inputMode="decimal"
                  adornEnd={currency}
                />
              </Field>

              <Field label={t('fields.cost')} optionalLabel={tApp('optional')} error={action.fieldError('cost')}>
                <Input
                  value={values.cost}
                  onChange={(event) => set('cost', event.target.value)}
                  inputMode="decimal"
                  adornEnd={currency}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('sections.organization')} />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('fields.status')}>
                  <NativeSelect
                    value={values.status}
                    onChange={(event) => set('status', event.target.value as ProductEditorInitial['status'])}
                  >
                    <option value="DRAFT">{t('status.DRAFT')}</option>
                    <option value="ACTIVE">{t('status.ACTIVE')}</option>
                    <option value="ARCHIVED">{t('status.ARCHIVED')}</option>
                  </NativeSelect>
                </Field>

                <Field label={t('fields.visibility')}>
                  <NativeSelect
                    value={values.visibility}
                    onChange={(event) =>
                      set('visibility', event.target.value as ProductEditorInitial['visibility'])
                    }
                  >
                    <option value="VISIBLE">{t('visibility.VISIBLE')}</option>
                    <option value="HIDDEN">{t('visibility.HIDDEN')}</option>
                  </NativeSelect>
                </Field>
              </div>

              <Field label={t('fields.tags')} optionalLabel={tApp('optional')}>
                <TagInput value={values.tags} onChange={(tags) => set('tags', tags)} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('sections.shipping')} />
            <CardBody className="space-y-3">
              <SwitchField
                checked={values.shippingRequired}
                onCheckedChange={(checked) => set('shippingRequired', checked)}
                label={t('sections.shipping')}
              />
              <SwitchField
                checked={values.freeShipping}
                onCheckedChange={(checked) => set('freeShipping', checked)}
                label={tStorefront('freeShipping')}
              />
              <Field label={t('fields.weight')} optionalLabel={tApp('optional')}>
                <Input
                  value={values.weightGrams}
                  onChange={(event) => set('weightGrams', event.target.value)}
                  inputMode="numeric"
                  adornEnd="g"
                  className="sm:max-w-40"
                />
              </Field>
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="mt-4">
          <Section title={t('media.title')}>
            <MediaUploader value={values.images} onChange={(images) => set('images', images)} />
          </Section>
        </TabsContent>

        <TabsContent value="options" className="mt-4 space-y-3">
          <Section title={t('options.title')}>
            <OptionEditor value={values.options} onChange={(options) => set('options', options)} />
          </Section>

          <Section title={t('variants.title')}>
            <VariantEditor
              options={values.options}
              variants={values.variants}
              onChange={(variants) => set('variants', variants)}
              productPrice={values.price}
              currency={currency}
            />
          </Section>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <Section title={t('inventory.title')}>
            <div className="space-y-4">
              <SwitchField
                checked={values.trackInventory}
                onCheckedChange={(checked) => set('trackInventory', checked)}
                label={t('inventory.track')}
                hint={t('inventory.trackHint')}
              />

              {values.trackInventory ? (
                <>
                  {hasVariants ? (
                    <p className="rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                      {t('variants.title')} — {t('inventory.quantity')}
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t('inventory.quantity')} error={action.fieldError('stockQuantity')}>
                        <Input
                          value={values.stockQuantity}
                          onChange={(event) => set('stockQuantity', event.target.value)}
                          inputMode="numeric"
                        />
                      </Field>

                      <Field label={t('inventory.lowStockThreshold')}>
                        <Input
                          value={values.lowStockThreshold}
                          onChange={(event) => set('lowStockThreshold', event.target.value)}
                          inputMode="numeric"
                        />
                      </Field>
                    </div>
                  )}

                  <SwitchField
                    checked={values.allowBackorder}
                    onCheckedChange={(checked) => set('allowBackorder', checked)}
                    label={t('inventory.allowBackorder')}
                  />
                </>
              ) : null}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="related" className="mt-4">
          <Section title={t('related.title')} description={t('related.hint')}>
            <RelatedProductsPicker
              value={values.related}
              onChange={(related) => set('related', related)}
              excludeId={initial.id}
              currency={currency}
              locale={currentLocale}
            />
          </Section>
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Section title={t('sections.seo')}>
            <div className="space-y-4">
              <Field label={t('fields.seoTitle')} optionalLabel={tApp('optional')}>
                <Input value={values.seoTitle} onChange={(event) => set('seoTitle', event.target.value)} />
              </Field>
              <Field label={t('fields.seoDescription')} optionalLabel={tApp('optional')}>
                <Textarea
                  value={values.seoDescription}
                  onChange={(event) => set('seoDescription', event.target.value)}
                  rows={3}
                />
              </Field>
            </div>
          </Section>
        </TabsContent>
      </Tabs>

      {/* Sticky action bar — always reachable in a long form, on any screen. */}
      <div className="sticky bottom-[calc(var(--bottom-nav-height)+0.5rem)] z-10 mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border bg-surface-elevated p-3 shadow-overlay lg:bottom-4">
        <p className="min-w-0 truncate text-xs text-subtle-foreground">
          {dirty ? tApp('unsavedChanges') : ''}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard/products`)}
            disabled={action.submitting}
          >
            {tApp('cancel')}
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={action.submitting}>
            {tApp('saveChanges')}
          </Button>
        </div>
      </div>

      {canDelete ? null : null}
    </form>
  );
}
