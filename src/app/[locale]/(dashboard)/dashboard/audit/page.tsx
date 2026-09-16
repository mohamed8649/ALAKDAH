import { ScrollText } from 'lucide-react';
import type { Metadata } from 'next';

import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/layout/page-header';
import { prisma } from '@/db/client';
import { getTranslations } from '@/i18n/server';
import { formatDateTime } from '@/lib/datetime';
import { requirePermission } from '@/server/policies/context';

export const metadata: Metadata = { title: 'سجل النشاط' };
export const dynamic = 'force-dynamic';

export default async function AuditPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('audit.view');
  const t = getTranslations(params.locale, 'audit');

  const entries = await prisma.auditLog.findMany({
    where: { storeId: context.storeId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      actorName: true,
      actorType: true,
      createdAt: true,
      metadata: true,
    },
  });

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />

      <Card>
        {entries.length === 0 ? (
          <EmptyState icon={<ScrollText />} title={t('empty')} />
        ) : (
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-foreground">
                      {t(`actions.${entry.action}`)}
                    </p>
                    <p className="truncate font-mono text-2xs text-subtle-foreground" dir="ltr">
                      {entry.entityType}
                      {entry.entityId ? `/${entry.entityId.slice(0, 12)}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-end">
                    <p className="text-xs text-muted-foreground">
                      {entry.actorName ?? t('system')}
                    </p>
                    <p className="text-2xs text-subtle-foreground">
                      {formatDateTime(entry.createdAt, params.locale, context.timezone)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
