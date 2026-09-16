'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { SwitchField } from '@/components/ui/misc';
import { ImageField } from '@/features/settings/image-field';
import { useTranslations } from '@/i18n/provider';

import type { PageBlock } from './blocks';

/**
 * Block property editor.
 *
 * Driven by the block type, so the merchant only ever sees the fields that
 * block actually has. The values written here go straight into the block's
 * props and are re-validated against the block schema on save.
 */
export function BlockPropsEditor({
  block,
  products,
  disabled,
  onChange,
}: {
  block: PageBlock;
  products: Array<{ id: string; name: string }>;
  disabled?: boolean;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const t = useTranslations('pages');
  const tApp = useTranslations('app');
  const props = block.props as Record<string, unknown>;

  const set = (key: string, value: unknown) => onChange({ ...props, [key]: value });

  const str = (key: string): string => (typeof props[key] === 'string' ? (props[key] as string) : '');
  const num = (key: string, fallback: number): number =>
    typeof props[key] === 'number' ? (props[key] as number) : fallback;
  const bool = (key: string, fallback = false): boolean =>
    typeof props[key] === 'boolean' ? (props[key] as boolean) : fallback;

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-4">
          <Field label={tApp('name')}>
            <Input
              value={str('headline')}
              disabled={disabled}
              onChange={(event) => set('headline', event.target.value)}
            />
          </Field>
          <Field label={tApp('description')}>
            <Textarea
              value={str('subheadline')}
              disabled={disabled}
              rows={3}
              onChange={(event) => set('subheadline', event.target.value)}
            />
          </Field>
          <ImageField
            label={t('blockTypes.image')}
            value={str('imageUrl')}
            disabled={disabled}
            folder="pages"
            onChange={(url) => set('imageUrl', url || null)}
          />
          <Field label={tApp('actions')}>
            <Input
              value={str('ctaText')}
              disabled={disabled}
              onChange={(event) => set('ctaText', event.target.value)}
            />
          </Field>
        </div>
      );

    case 'text':
      return (
        <div className="space-y-4">
          <Field label={tApp('description')}>
            <Textarea
              value={str('content')}
              disabled={disabled}
              rows={8}
              onChange={(event) => set('content', event.target.value)}
            />
          </Field>
          <Field label={tApp('sortBy')}>
            <NativeSelect
              value={str('align') || 'start'}
              disabled={disabled}
              onChange={(event) => set('align', event.target.value)}
            >
              <option value="start">start</option>
              <option value="center">center</option>
              <option value="end">end</option>
            </NativeSelect>
          </Field>
        </div>
      );

    case 'image':
      return (
        <div className="space-y-4">
          <ImageField
            label={t('blockTypes.image')}
            value={str('url')}
            disabled={disabled}
            folder="pages"
            onChange={(url) => set('url', url || null)}
          />
          <Field label="alt" hint={tApp('optional')}>
            <Input
              value={str('alt')}
              disabled={disabled}
              onChange={(event) => set('alt', event.target.value)}
            />
          </Field>
        </div>
      );

    case 'features':
    case 'testimonials':
    case 'faq': {
      const items = Array.isArray(props.items) ? (props.items as Record<string, string>[]) : [];

      const fields =
        block.type === 'features'
          ? (['title', 'description'] as const)
          : block.type === 'testimonials'
            ? (['name', 'quote'] as const)
            : (['question', 'answer'] as const);

      return (
        <div className="space-y-4">
          <Field label={tApp('name')}>
            <Input
              value={str('title')}
              disabled={disabled}
              onChange={(event) => set('title', event.target.value)}
            />
          </Field>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-[var(--radius)] border border-border p-2.5">
                {fields.map((field) => (
                  <Input
                    key={field}
                    value={item[field] ?? ''}
                    disabled={disabled}
                    placeholder={field}
                    aria-label={field}
                    onChange={(event) =>
                      set(
                        'items',
                        items.map((entry, position) =>
                          position === index ? { ...entry, [field]: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                ))}

                <div className="flex justify-end">
                  <IconButton
                    label={tApp('delete')}
                    icon={<Trash2 />}
                    variant="danger"
                    size="sm"
                    disabled={disabled}
                    onClick={() =>
                      set(
                        'items',
                        items.filter((_, position) => position !== index),
                      )
                    }
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              block
              disabled={disabled}
              onClick={() =>
                set('items', [
                  ...items,
                  Object.fromEntries(fields.map((field) => [field, ''])),
                ])
              }
            >
              <Plus aria-hidden />
              {tApp('add')}
            </Button>
          </div>
        </div>
      );
    }

    case 'product':
    case 'orderForm':
      return (
        <div className="space-y-4">
          {block.type === 'orderForm' ? (
            <Field label={tApp('name')}>
              <Input
                value={str('title')}
                disabled={disabled}
                onChange={(event) => set('title', event.target.value)}
              />
            </Field>
          ) : null}

          <Field label={t('ai.product')}>
            <NativeSelect
              value={str('productId')}
              disabled={disabled}
              onChange={(event) => set('productId', event.target.value || null)}
            >
              <option value="">—</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          {block.type === 'product' ? (
            <SwitchField
              checked={bool('showPrice', true)}
              onCheckedChange={(checked) => set('showPrice', checked)}
              disabled={disabled}
              label={tApp('price')}
            />
          ) : null}
        </div>
      );

    case 'offer':
    case 'cta':
      return (
        <div className="space-y-4">
          <Field label={tApp('name')}>
            <Input
              value={str(block.type === 'cta' ? 'headline' : 'title')}
              disabled={disabled}
              onChange={(event) =>
                set(block.type === 'cta' ? 'headline' : 'title', event.target.value)
              }
            />
          </Field>

          <Field label={block.type === 'cta' ? tApp('actions') : tApp('description')}>
            {block.type === 'cta' ? (
              <Input
                value={str('text')}
                disabled={disabled}
                onChange={(event) => set('text', event.target.value)}
              />
            ) : (
              <Textarea
                value={str('description')}
                disabled={disabled}
                rows={3}
                onChange={(event) => set('description', event.target.value)}
              />
            )}
          </Field>
        </div>
      );

    case 'countdown':
      return (
        <div className="space-y-4">
          <Field label={tApp('name')}>
            <Input
              value={str('title')}
              disabled={disabled}
              onChange={(event) => set('title', event.target.value)}
            />
          </Field>
          <Field label={tApp('to')}>
            <Input
              type="datetime-local"
              value={str('endsAt').slice(0, 16)}
              disabled={disabled}
              onChange={(event) =>
                set('endsAt', event.target.value ? new Date(event.target.value).toISOString() : null)
              }
            />
          </Field>
        </div>
      );

    case 'productGrid':
      return (
        <Field label={tApp('rowsPerPage')}>
          <Input
            inputMode="numeric"
            value={String(num('limit', 8))}
            disabled={disabled}
            onChange={(event) => set('limit', Math.max(2, Number(event.target.value) || 8))}
          />
        </Field>
      );

    case 'video':
      return (
        <div className="space-y-4">
          <Field label={tApp('name')}>
            <NativeSelect
              value={str('provider') || 'youtube'}
              disabled={disabled}
              onChange={(event) => set('provider', event.target.value)}
            >
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
            </NativeSelect>
          </Field>
          {/* Only the id — a full URL or embed snippet is never accepted. */}
          <Field label="ID" hint="dQw4w9WgXcQ">
            <Input
              dir="ltr"
              value={str('videoId')}
              disabled={disabled}
              onChange={(event) => set('videoId', event.target.value)}
            />
          </Field>
        </div>
      );

    case 'spacer':
      return (
        <Field label={tApp('name')}>
          <NativeSelect
            value={str('size') || 'md'}
            disabled={disabled}
            onChange={(event) => set('size', event.target.value)}
          >
            <option value="sm">sm</option>
            <option value="md">md</option>
            <option value="lg">lg</option>
          </NativeSelect>
        </Field>
      );

    case 'trust':
      return (
        <SwitchField
          checked={bool('useStoreBadges', true)}
          onCheckedChange={(checked) => set('useStoreBadges', checked)}
          disabled={disabled}
          label={t('blockTypes.trust')}
        />
      );

    default:
      return <p className="text-xs text-subtle-foreground">—</p>;
  }
}
