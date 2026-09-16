import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { DashboardShell } from '@/features/dashboard/dashboard-shell';
import { prisma } from '@/db/client';
import { getSessionUser } from '@/server/auth/session';
import { getStoreContext, listUserStores } from '@/server/policies/context';

/**
 * Dashboard layout.
 *
 * Authentication and tenancy are resolved once, here. Pages below receive an
 * already-authorised store context; none of them re-derives it from the URL.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect(`/${params.locale}/login`);

  const context = await getStoreContext();
  if (!context) redirect(`/${params.locale}/login`);

  const stores = await listUserStores();
  const activeStore = stores.find((store) => store.id === context.storeId);

  const notificationCount = await prisma.notification.count({
    where: { storeId: context.storeId, readAt: null },
  });

  return (
    <DashboardShell
      user={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }}
      stores={stores.map((store) => ({
        id: store.id,
        name: store.name,
        slug: store.slug,
        logoUrl: store.logoUrl,
      }))}
      activeStore={{
        id: context.storeId,
        name: context.storeName,
        slug: context.storeSlug,
        logoUrl: activeStore?.logoUrl ?? null,
      }}
      permissions={[...context.permissions]}
      roleKey={context.roleKey}
      notificationCount={notificationCount}
      locale={params.locale}
    >
      {children}
    </DashboardShell>
  );
}
