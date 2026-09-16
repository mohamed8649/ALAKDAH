import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/layout/page-header';
import { getTranslations } from '@/i18n/server';
import { formatRelative } from '@/lib/datetime';
import { formatNumber } from '@/lib/money';
import { hasPermission, requirePermission } from '@/server/policies/context';
import { listPages } from '@/server/services/page-service';

export const metadata: Metadata = { title: 'صفحات الهبوط' };
export const dynamic = 'force-dynamic';

export default async function PagesListPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('pages.view');
  const t = getTranslations(params.locale, 'pages');
  const tApp = getTranslations(params.locale, 'app');

  const pages = await listPages(context);
  const canManage = hasPermission(context, 'pages.manage');
  const active = pages.filter((page) => page.status === 'PUBLISHED').length;

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage ? (
            <Button asChild variant="primary" size="sm">
              <Link href={`/${params.locale}/dashboard/pages/new`}>
                <Plus aria-hidden />
                {t('create')}
              </Link>
            </Button>
          ) : null
        }
      />

      {pages.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title={t('empty')}
            description={t('emptyDescription')}
            action={
              canManage ? (
                <Button asChild variant="primary" size="sm">
                  <Link href={`/${params.locale}/dashboard/pages/new`}>
                    <Plus aria-hidden />
                    {t('create')}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{t('count', { count: formatNumber(pages.length, params.locale) })}</span>
            <span>·</span>
            <span>{t('activeCount', { count: formatNumber(active, params.locale) })}</span>
            <span>·</span>
            <span>
              {t('inactiveCount', { count: formatNumber(pages.length - active, params.locale) })}
            </span>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pages.map((page) => (
              <li key={page.id}>
                <Card className="h-full">
                  <CardBody className="flex h-full flex-col gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/${params.locale}/dashboard/pages/${page.id}`}
                        className="block truncate text-[13px] font-medium text-foreground hover:text-primary"
                      >
                        {page.title}
                      </Link>
                      <p className="truncate font-mono text-2xs text-subtle-foreground" dir="ltr">
                        /{page.slug}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={page.status === 'PUBLISHED' ? 'success' : 'neutral'} dot>
                        {page.status === 'PUBLISHED' ? tApp('published') : tApp('draft')}
                      </Badge>
                      {page.generatedByAi ? <Badge tone="accent">AI</Badge> : null}
                      <Badge tone="outline">{page.blockCount}</Badge>
                    </div>

                    <dl className="mt-auto flex gap-4 text-2xs">
                      <div>
                        <dt className="text-subtle-foreground">{t('views')}</dt>
                        <dd className="tabular-nums text-foreground">
                          {formatNumber(page.views, params.locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-subtle-foreground">{t('conversions')}</dt>
                        <dd className="tabular-nums text-foreground">
                          {formatNumber(page.conversions, params.locale)}
                        </dd>
                      </div>
                      <div className="ms-auto text-end">
                        <dt className="text-subtle-foreground">{tApp('updatedAt')}</dt>
                        <dd className="text-foreground">
                          {formatRelative(page.updatedAt, params.locale)}
                        </dd>
                      </div>
                    </dl>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
