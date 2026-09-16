import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { ThemeStore } from '@/features/themes/theme-store';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { listThemes } from '@/server/services/theme-service';

export const metadata: Metadata = { title: 'متجر القوالب' };
export const dynamic = 'force-dynamic';

export default async function ThemesPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('themes.manage');
  const t = getTranslations(params.locale, 'themes');
  const themes = await listThemes(context);

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <ThemeStore themes={themes} storeSlug={context.storeSlug} locale={params.locale} />
    </div>
  );
}
