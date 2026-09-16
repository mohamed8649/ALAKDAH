import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { Metadata } from 'next';

import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/layout/page-header';
import { prisma } from '@/db/client';
import { getTranslations } from '@/i18n/server';
import { formatRelative } from '@/lib/datetime';
import { requireStoreContext } from '@/server/policies/context';

export const metadata: Metadata = { title: 'الإشعارات' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage({ params }: { params: { locale: string } }) {
  const context = await requireStoreContext();
  const t = getTranslations(params.locale, 'app');

  const notifications = await prisma.notification.findMany({
    where: { storeId: context.storeId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Opening the list is the acknowledgement — marking read here keeps the
  // topbar badge honest without an extra click.
  if (notifications.some((notification) => notification.readAt === null)) {
    await prisma.notification.updateMany({
      where: { storeId: context.storeId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return (
    <div>
      <PageHeader title={t('notifications')} />

      <Card>
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell />} title={t('noNotifications')} />
        ) : (
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {notifications.map((notification) => {
                const body = (
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{notification.titleAr}</p>
                      {notification.bodyAr ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {notification.bodyAr}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-2xs text-subtle-foreground">
                      {formatRelative(notification.createdAt, params.locale)}
                    </span>
                  </div>
                );

                return (
                  <li key={notification.id}>
                    {notification.link ? (
                      <Link
                        href={`/${params.locale}${notification.link}`}
                        className="block transition-colors duration-fast hover:bg-surface-2"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
