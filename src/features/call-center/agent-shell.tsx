'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ListChecks, LogOut } from 'lucide-react';
import { useTransition, type ReactNode } from 'react';

import { agentLogoutAction } from '@/app/actions/session';
import { IconButton } from '@/components/ui/icon-button';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/**
 * Agent shell.
 *
 * Built for a phone held in one hand while the other holds a call: large touch
 * targets, two destinations, and the store name always visible so an agent
 * working for two merchants knows which queue they are in.
 */
export function AgentShell({
  children,
  agent,
  locale,
}: {
  children: ReactNode;
  agent: { fullName: string; username: string; storeName: string };
  locale: string;
}) {
  const t = useTranslations('callCenter.portal');
  const tApp = useTranslations('app');
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const items = [
    { href: `/${locale}/agent/orders`, label: t('title'), icon: ListChecks },
    { href: `/${locale}/agent/stats`, label: t('myStats'), icon: BarChart3 },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-surface-1/95 px-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{agent.fullName}</p>
          <p className="truncate text-2xs text-subtle-foreground">{agent.storeName}</p>
        </div>

        <IconButton
          label={tApp('logout')}
          icon={<LogOut />}
          onClick={() => startTransition(async () => { await agentLogoutAction(locale); })}
        />
      </header>

      <main className="px-3 pb-[calc(var(--bottom-nav-height)+1.5rem)] pt-4 sm:px-4">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex h-[var(--bottom-nav-height)] items-stretch border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)]"
        aria-label={t('title')}
      >
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-medium',
                'transition-colors duration-fast',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
