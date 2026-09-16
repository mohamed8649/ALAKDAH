'use client';

import { Check, Download, Eye, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useState } from 'react';

import { activateThemeAction, installThemeAction } from '@/app/actions/themes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { IconButton } from '@/components/ui/icon-button';
import { useToast } from '@/components/ui/toast';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import type { ThemeTokens } from '@/server/catalog/themes';

interface ThemeCardData {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  previewImage: string | null;
  isPremium: boolean;
  isInstalled: boolean;
  isActive: boolean;
  tokens: ThemeTokens;
}

type Viewport = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_WIDTH: Record<Viewport, number> = { desktop: 1000, tablet: 768, mobile: 390 };

/**
 * Theme store.
 *
 * Preview is isolated from the live storefront: it renders a miniature of the
 * theme's own tokens in an iframe pointed at the shop with a preview flag, so
 * looking never changes what customers see.
 */
export function ThemeStore({
  themes,
  storeSlug,
  locale,
}: {
  themes: ThemeCardData[];
  storeSlug: string;
  locale: string;
}) {
  const t = useTranslations('themes');
  const tApp = useTranslations('app');
  const { toast } = useToast();

  const [previewing, setPreviewing] = useState<ThemeCardData | null>(null);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [previewLocale, setPreviewLocale] = useState(locale);
  const [pending, setPending] = useState<string | null>(null);

  const install = async (theme: ThemeCardData) => {
    setPending(theme.key);
    const result = await installThemeAction(theme.key);
    setPending(null);
    toast({
      title: result.ok ? t('installedToast') : tApp('retry'),
      tone: result.ok ? 'success' : 'error',
    });
  };

  const activate = async (theme: ThemeCardData) => {
    setPending(theme.key);
    const result = await activateThemeAction(theme.key);
    setPending(null);
    setPreviewing(null);
    toast({
      title: result.ok ? t('activated') : tApp('retry'),
      tone: result.ok ? 'success' : 'error',
    });
  };

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => (
          <li key={theme.key}>
            <Card className={cn('h-full', theme.isActive && 'border-primary ring-1 ring-[var(--primary)]')}>
              {/* Token swatch stands in for a screenshot: it is generated from
                  the theme's own values, so it can never go stale. */}
              <div
                className="flex h-32 items-end gap-2 p-4"
                style={{ backgroundColor: theme.tokens.background }}
              >
                <span
                  className="h-8 flex-1 rounded"
                  style={{ backgroundColor: theme.tokens.primary, borderRadius: theme.tokens.radius }}
                />
                <span
                  className="h-5 w-12 rounded"
                  style={{ backgroundColor: theme.tokens.surface, borderRadius: theme.tokens.radius }}
                />
                <span
                  className="h-3 w-8 rounded"
                  style={{ backgroundColor: theme.tokens.muted, borderRadius: theme.tokens.radius }}
                />
              </div>

              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{theme.nameAr}</p>
                    {theme.descriptionAr ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {theme.descriptionAr}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {theme.isActive ? (
                    <Badge tone="primary" icon={<Check className="size-3" />}>
                      {t('active')}
                    </Badge>
                  ) : theme.isInstalled ? (
                    <Badge tone="success">{t('installed')}</Badge>
                  ) : null}
                  {theme.isPremium ? <Badge tone="accent">Premium</Badge> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewing(theme)}
                    className="flex-1"
                  >
                    <Eye aria-hidden />
                    {t('preview')}
                  </Button>

                  {theme.isActive ? null : theme.isInstalled ? (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={pending === theme.key}
                      onClick={() => activate(theme)}
                      className="flex-1"
                    >
                      {t('activate')}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={pending === theme.key}
                      onClick={() => install(theme)}
                      className="flex-1"
                    >
                      <Download aria-hidden />
                      {t('install')}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={previewing !== null} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent
          size="xl"
          title={previewing ? t('previewTitle', { name: previewing.nameAr }) : ''}
          description={t('previewNote')}
          footer={
            previewing && !previewing.isActive ? (
              <Button
                variant="primary"
                loading={pending === previewing.key}
                onClick={() => activate(previewing)}
              >
                {t('activate')}
              </Button>
            ) : null
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {(['desktop', 'tablet', 'mobile'] as const).map((option) => {
                  const Icon =
                    option === 'desktop' ? Monitor : option === 'tablet' ? Tablet : Smartphone;
                  return (
                    <IconButton
                      key={option}
                      label={option}
                      icon={<Icon />}
                      size="sm"
                      variant={viewport === option ? 'solid' : 'ghost'}
                      onClick={() => setViewport(option)}
                    />
                  );
                })}
              </div>

              {/* RTL and LTR are both first-class, so the preview switches
                  direction rather than only translating labels. */}
              <div className="flex gap-1">
                {(['ar', 'en'] as const).map((option) => (
                  <Button
                    key={option}
                    variant={previewLocale === option ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewLocale(option)}
                  >
                    {option === 'ar' ? 'العربية' : 'English'}
                  </Button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface-2 p-3">
              <iframe
                key={`${previewing?.key}-${previewLocale}-${viewport}`}
                title={previewing?.nameAr ?? 'preview'}
                src={`/${previewLocale}/${storeSlug}/preview?theme=${previewing?.key ?? ''}`}
                width={VIEWPORT_WIDTH[viewport]}
                height={520}
                className="mx-auto rounded-[var(--radius)] border border-border bg-white"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
