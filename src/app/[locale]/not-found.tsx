import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/server';

/**
 * Locale-scoped 404.
 *
 * Next.js does not pass params to not-found, so the copy defaults to Arabic —
 * the platform's primary language — and the links stay locale-relative.
 */
export default function LocaleNotFound() {
  const t = getTranslations('ar', 'errors');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-3 text-muted-foreground">
        <FileQuestion className="size-6" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-foreground">{t('pageNotFound')}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('pageNotFoundDescription')}</p>
      <Button asChild variant="primary" size="touch" className="mt-5">
        <Link href="/ar/dashboard">{t('backToDashboard')}</Link>
      </Button>
    </div>
  );
}
