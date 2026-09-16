'use client';

import { ChevronLeft, ChevronRight, ImagePlus, RefreshCw, Star, Trash2, X } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { EmptyState } from '@/components/ui/states';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/**
 * Product media uploader.
 *
 * Each file gets its own lifecycle: queued, uploading with real progress,
 * uploaded, or failed with a retry. One failure never discards the others, and
 * a failed upload stays visible with a retry rather than vanishing.
 *
 * Reordering is button-based rather than drag-only: dragging a thumbnail on a
 * touch screen fights with page scrolling, and buttons are reachable by
 * keyboard.
 */

export interface MediaItem {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

interface UploadTask {
  tempId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'error';
  error?: string;
  file: File;
}

const MAX_IMAGES = 20;

export function MediaUploader({
  value,
  onChange,
  disabled,
}: {
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('products.media');
  const tApp = useTranslations('app');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(
    (file: File, tempId: string) => {
      setTasks((current) => {
        const existing = current.find((task) => task.tempId === tempId);
        const next: UploadTask = {
          tempId,
          filename: file.name,
          progress: 0,
          status: 'uploading',
          file,
        };
        return existing
          ? current.map((task) => (task.tempId === tempId ? next : task))
          : [...current, next];
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'products');

      // XHR rather than fetch: it reports upload progress, which fetch does not.
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/uploads');

      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        setTasks((current) =>
          current.map((task) => (task.tempId === tempId ? { ...task, progress } : task)),
        );
      });

      xhr.addEventListener('load', () => {
        let payload: { ok?: boolean; data?: { url: string }; error?: { reason?: string } } = {};
        try {
          payload = JSON.parse(xhr.responseText) as typeof payload;
        } catch {
          payload = {};
        }

        if (xhr.status >= 200 && xhr.status < 300 && payload.ok && payload.data) {
          setTasks((current) => current.filter((task) => task.tempId !== tempId));
          onChange([
            ...value,
            {
              id: `tmp_${tempId}`,
              url: payload.data!.url,
              altText: null,
              isPrimary: value.length === 0,
            },
          ]);
          return;
        }

        const reason = payload.error?.reason;
        setTasks((current) =>
          current.map((task) =>
            task.tempId === tempId
              ? {
                  ...task,
                  status: 'error',
                  error:
                    reason === 'type' || reason === 'content'
                      ? t('invalidType')
                      : reason === 'size'
                        ? t('tooLarge', { max: 5 })
                        : t('failed'),
                }
              : task,
          ),
        );
      });

      xhr.addEventListener('error', () => {
        setTasks((current) =>
          current.map((task) =>
            task.tempId === tempId ? { ...task, status: 'error', error: t('failed') } : task,
          ),
        );
      });

      xhr.send(formData);
    },
    [onChange, t, value],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || disabled) return;
      const room = MAX_IMAGES - value.length - tasks.length;
      Array.from(files)
        .slice(0, Math.max(0, room))
        .forEach((file) => upload(file, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`));
    },
    [disabled, tasks.length, upload, value.length],
  );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next.map((entry, position) => ({ ...entry, isPrimary: position === 0 })));
  };

  const remove = (index: number) => {
    const next = value.filter((_, position) => position !== index);
    onChange(next.map((entry, position) => ({ ...entry, isPrimary: position === 0 })));
  };

  const setPrimary = (index: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    onChange([item!, ...next].map((entry, position) => ({ ...entry, isPrimary: position === 0 })));
  };

  const atCapacity = value.length + tasks.length >= MAX_IMAGES;

  return (
    <div className="space-y-3">
      <p className="text-xs text-subtle-foreground">{t('hint')}</p>

      {value.length === 0 && tasks.length === 0 ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            'rounded-[var(--radius-lg)] border border-dashed transition-colors duration-fast',
            dragOver ? 'border-primary bg-[var(--primary-soft)]' : 'border-border',
          )}
        >
          <EmptyState
            compact
            icon={<ImagePlus />}
            title={t('empty')}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus aria-hidden />
                {t('upload')}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {value.map((item, index) => (
            <li
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-[var(--radius)] border border-border bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary upload paths */}
              <img src={item.url} alt={item.altText ?? ''} className="size-full object-cover" />

              {index === 0 ? (
                <span className="absolute top-1 inset-inline-start-0 start-1 rounded-[var(--radius-sm)] bg-primary px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary-foreground)]">
                  {t('primary')}
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/70 p-1 opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover:opacity-100">
                <IconButton
                  label={t('moveUp')}
                  icon={<ChevronRight className="rtl-flip" />}
                  size="sm"
                  className="text-white hover:bg-white/20"
                  disabled={index === 0 || disabled}
                  onClick={() => move(index, -1)}
                />
                <IconButton
                  label={t('moveDown')}
                  icon={<ChevronLeft className="rtl-flip" />}
                  size="sm"
                  className="text-white hover:bg-white/20"
                  disabled={index === value.length - 1 || disabled}
                  onClick={() => move(index, 1)}
                />
                {index !== 0 ? (
                  <IconButton
                    label={t('setPrimary')}
                    icon={<Star />}
                    size="sm"
                    className="text-white hover:bg-white/20"
                    disabled={disabled}
                    onClick={() => setPrimary(index)}
                  />
                ) : null}
                <IconButton
                  label={t('removeImage')}
                  icon={<Trash2 />}
                  size="sm"
                  className="text-white hover:bg-[var(--danger)]"
                  disabled={disabled}
                  onClick={() => remove(index)}
                />
              </div>
            </li>
          ))}

          {tasks.map((task) => (
            <li
              key={task.tempId}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius)] border p-2 text-center',
                task.status === 'error' ? 'border-danger bg-[var(--danger-soft)]' : 'border-border bg-surface-2',
              )}
            >
              {task.status === 'uploading' ? (
                <>
                  <span className="w-full px-2">
                    <span className="block h-1 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-fast"
                        style={{ width: `${task.progress}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-2xs tabular-nums text-muted-foreground">
                    {task.progress}%
                  </span>
                  <span className="line-clamp-2 px-1 text-[10px] text-subtle-foreground">
                    {task.filename}
                  </span>
                </>
              ) : (
                <>
                  <span className="px-1 text-[10px] leading-tight text-danger">{task.error}</span>
                  <div className="flex gap-1">
                    <IconButton
                      label={tApp('retry')}
                      icon={<RefreshCw />}
                      size="sm"
                      onClick={() => upload(task.file, task.tempId)}
                    />
                    <IconButton
                      label={tApp('remove')}
                      icon={<X />}
                      size="sm"
                      onClick={() =>
                        setTasks((current) => current.filter((entry) => entry.tempId !== task.tempId))
                      }
                    />
                  </div>
                </>
              )}
            </li>
          ))}

          {!atCapacity ? (
            <li>
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-dashed border-border text-subtle-foreground transition-colors duration-fast hover:border-border-strong hover:text-foreground disabled:opacity-50"
              >
                <ImagePlus className="size-5" aria-hidden />
                <span className="text-[10px]">{t('upload')}</span>
              </button>
            </li>
          ) : null}
        </ul>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
