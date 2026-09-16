import Link from 'next/link';
import { Sparkles, Wrench } from 'lucide-react';
import type { Metadata } from 'next';

import { Card, CardBody } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { getTranslations } from '@/i18n/server';
import { requirePermission } from '@/server/policies/context';
import { hasFeature } from '@/server/services/billing-service';

export const metadata: Metadata = { title: 'صفحة جديدة' };
export const dynamic = 'force-dynamic';

/**
 * Creation chooser.
 *
 * Two independent routes into the same page model: build it by hand, or
 * generate a draft and then edit it in the same builder.
 */
export default async function NewPageChooser({ params }: { params: { locale: string } }) {
  const context = await requirePermission('pages.manage');
  const t = getTranslations(params.locale, 'pages');

  const aiAvailable = await hasFeature(context.storeId, 'ai_tools');
  const base = `/${params.locale}/dashboard/pages`;

  return (
    <div>
      <PageHeader title={t('create')} backHref={base} backLabel={t('title')} />

      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Link href={`${base}/builder`} className="block h-full">
            <Card className="h-full transition-colors duration-fast hover:border-border-strong">
              <CardBody className="space-y-2">
                <span className="flex size-9 items-center justify-center rounded-[var(--radius)] bg-[var(--primary-soft)] text-primary">
                  <Wrench className="size-4" aria-hidden />
                </span>
                <p className="text-[13px] font-medium text-foreground">{t('createManual')}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('createManualHint')}
                </p>
              </CardBody>
            </Card>
          </Link>
        </li>

        <li>
          <Link
            href={aiAvailable ? `${base}/generate` : `/${params.locale}/dashboard/billing`}
            className="block h-full"
          >
            <Card className="h-full transition-colors duration-fast hover:border-border-strong">
              <CardBody className="space-y-2">
                <span className="flex size-9 items-center justify-center rounded-[var(--radius)] bg-[var(--accent-soft)] text-accent">
                  <Sparkles className="size-4" aria-hidden />
                </span>
                <p className="text-[13px] font-medium text-foreground">{t('createAi')}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{t('createAiHint')}</p>
                {!aiAvailable ? (
                  <p className="text-2xs text-warning">
                    {getTranslations(params.locale, 'apps')('notInPlan')}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          </Link>
        </li>
      </ul>
    </div>
  );
}
