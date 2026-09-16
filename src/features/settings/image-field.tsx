'use client';

import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/**
 * Single-image field (logo, favicon, collection image).
 *
 * Shares the upload endpoint with the product media uploader, including its
 * server-side type, size and magic-byte validation. Failures are shown inline
 * with a retry rather than as a toast that vanishes.
 */
export function ImageField({
  label,
  value,
  onChange,
  disabled,
  folder = 'branding',
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  folder?: string;
  hint?: string;
}) {
  const t = useTranslations('products.media');
  const tApp = useTranslations('app');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    try {
      const response = await fetch('/api/uploads', { method: 'POST', body: formData });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { url: string };
        error?: { reason?: string };
      };

      if (response.ok && payload.ok && payload.data) {
        onChange(payload.data.url);
      } else {
        const reason = payload.error?.reason;
        setError(
          reason === 'type' || reason === 'content'
            ? t('invalidType')
            : reason === 'size'
              ? t('tooLarge', { max: 5 })
              : t('failed'),
        );
      }
    } catch {
      setError(t('failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] border border-border bg-surface-2',
            uploading && 'animate-pulse',
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary upload path
            <img src={value} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-5 text-subtle-foreground" aria-hidden />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? t('uploading') : t('upload')}
          </Button>

          {value ? (
            <IconButton
              label={tApp('remove')}
              icon={<Trash2 />}
              variant="danger"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChange('');
                setError(null);
              }}
            />
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }}
      />
    </Field>
  );
}
