'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';

import { AppShell, type ShellStore } from '@/components/layout/app-shell';
import { logoutAction, switchStoreAction } from '@/app/actions/session';

/**
 * Client wrapper around AppShell.
 *
 * Keeps the shell itself free of server-action imports, so the layout above can
 * stay a server component and the interactive parts stay small.
 */
export function DashboardShell({
  children,
  user,
  stores,
  activeStore,
  permissions,
  roleKey,
  notificationCount,
  locale,
}: {
  children: ReactNode;
  user: { id: string; fullName: string; email: string; avatarUrl: string | null };
  stores: ShellStore[];
  activeStore: ShellStore;
  permissions: string[];
  roleKey: string;
  notificationCount: number;
  locale: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <AppShell
      user={user}
      stores={stores}
      activeStore={activeStore}
      permissions={permissions}
      roleKey={roleKey}
      notificationCount={notificationCount}
      onSwitchStore={(storeId) => {
        startTransition(async () => {
          await switchStoreAction(storeId);
          router.refresh();
        });
      }}
      onLogout={() => {
        startTransition(async () => {
          await logoutAction(locale);
        });
      }}
    >
      {children}
    </AppShell>
  );
}
