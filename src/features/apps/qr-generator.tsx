'use client';

import { Download, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { useTranslations } from '@/i18n/provider';

const SIZES = [256, 512, 1024] as const;

/**
 * QR generator.
 *
 * Runs entirely in the browser: the destination is often a link the merchant
 * has not published yet, and there is no reason for it to travel to a server
 * or be stored. The download is produced from the same canvas that renders the
 * preview, so what is saved is exactly what was shown.
 */
export function QrGenerator({ presets }: { presets: Array<{ label: string; url: string }> }) {
  const t = useTranslations('qr');
  const tApp = useTranslations('app');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [destination, setDestination] = useState(presets[0]?.url ?? '');
  const [size, setSize] = useState<(typeof SIZES)[number]>(512);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    const render = async () => {
      if (!destination.trim()) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Loaded on demand so the encoder is not in the initial dashboard bundle.
      const QRCode = (await import('qrcode')).default;
      if (cancelled) return;

      try {
        await QRCode.toCanvas(canvas, destination, {
          width: size,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
        setError(null);
      } catch {
        setError(t('failed'));
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [destination, size, t]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `qr-${size}.png`;
    link.click();
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('title')} description={t('subtitle')} />
        <CardBody className="space-y-4">
          {presets.length > 0 ? (
            <Field label={t('preset')}>
              <NativeSelect
                value={presets.some((preset) => preset.url === destination) ? destination : ''}
                onChange={(event) => event.target.value && setDestination(event.target.value)}
              >
                <option value="">{t('custom')}</option>
                {presets.map((preset) => (
                  <option key={preset.url} value={preset.url}>
                    {preset.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}

          <Field label={t('destination')} required error={error}>
            <Input
              dir="ltr"
              value={destination}
              placeholder="https://"
              onChange={(event) => setDestination(event.target.value)}
            />
          </Field>

          <Field label={t('size')}>
            <NativeSelect
              value={String(size)}
              onChange={(event) =>
                setSize(Number(event.target.value) as (typeof SIZES)[number])
              }
            >
              {SIZES.map((option) => (
                <option key={option} value={option}>
                  {option} × {option}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Button
            type="button"
            variant="primary"
            disabled={!destination.trim() || error !== null}
            onClick={download}
          >
            <Download aria-hidden />
            {t('download')}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={tApp('preview')} />
        <CardBody className="flex items-center justify-center bg-surface-2">
          {destination.trim() ? (
            <canvas
              ref={canvasRef}
              // Rendered at the chosen resolution but displayed at a fixed size,
              // so a 1024px code downloads sharp without dominating the page.
              className="size-56 max-w-full rounded-[var(--radius)] bg-white p-2"
              role="img"
              aria-label={t('title')}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-subtle-foreground">
              <QrCode className="size-8" aria-hidden />
              <p className="text-xs">{t('emptyHint')}</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
