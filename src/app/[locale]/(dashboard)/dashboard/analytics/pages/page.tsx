import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { Metadata } from 'next';

import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { getTranslations } from '@/i18n/server';
import { formatNumber, formatPercent } from '@/lib/money';
import { requirePermission } from '@/server/policies/context';
import { getPageAnalytics, MIN_VIEWS_FOR_CONVERSION } from '@/server/services/analytics-service';

export const metadata: Metadata = { title: 'تقرير الصفحات' };
export const dynamic = 'force-dynamic';

export default async function PageAnalyticsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('analytics.view');
  const rows = await getPageAnalytics(context);

  const t = getTranslations(params.locale, 'analytics');
  const tPages = getTranslations(params.locale, 'pages');

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon={<FileText />} title={tPages('empty')} description={tPages('emptyDescription')} />
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.pageId} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${params.locale}/dashboard/pages/${row.pageId}`}
                  className="truncate text-[13px] font-medium text-foreground hover:text-primary"
                >
                  {row.title}
                </Link>
                <p className="truncate font-mono text-2xs text-subtle-foreground" dir="ltr">
                  /{row.slug}
                </p>
              </div>

              <dl className="flex shrink-0 items-center gap-4 text-xs">
                <div className="text-end">
                  <dt className="text-subtle-foreground">{tPages('views')}</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatNumber(row.views, params.locale)}
                  </dd>
                </div>
                <div className="text-end">
                  <dt className="text-subtle-foreground">{tPages('conversions')}</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatNumber(row.conversions, params.locale)}
                  </dd>
                </div>
                <div className="w-16 text-end">
                  <dt className="text-subtle-foreground">{t('metrics.conversion')}</dt>
                  <dd className="tabular-nums text-foreground">
                    {/* Null, not 0%: below the event threshold the ratio is noise. */}
                    {row.conversionRate === null
                      ? '—'
                      : formatPercent(row.conversionRate, params.locale)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </CardBody>

      <div className="border-t border-border px-4 py-2.5">
        <p className="text-2xs text-subtle-foreground">
          {t('definitionText.conversion')} ({MIN_VIEWS_FOR_CONVERSION}+)
        </p>
      </div>
    </Card>
  );
}
