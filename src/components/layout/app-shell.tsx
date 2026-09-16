'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  Moon,
  Search,
  Store,
  Sun,
  User,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { IconButton } from '@/components/ui/icon-button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useLocale, useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

import { Icon } from './icon';
import {
  filterNavigation,
  isNavActive,
  MOBILE_PRIMARY_KEYS,
  stripLocale,
  type NavItem,
} from './navigation';

/**
 * Dashboard shell.
 *
 * Desktop and mobile are two different layouts, not one layout squeezed. On a
 * phone: a compact top bar, a four-item bottom bar and a drawer holding the
 * rest. On a desktop: a persistent sidebar with grouped sections.
 */

export interface ShellStore {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface AppShellProps {
  children: ReactNode;
  user: { id: string; fullName: string; email: string; avatarUrl: string | null };
  stores: ShellStore[];
  activeStore: ShellStore;
  permissions: readonly string[];
  roleKey: string;
  notificationCount: number;
  onSwitchStore: (storeId: string) => void;
  onLogout: () => void;
}

export function AppShell({
  children,
  user,
  stores,
  activeStore,
  permissions,
  roleKey,
  notificationCount,
  onSwitchStore,
  onLogout,
}: AppShellProps) {
  const t = useTranslations('nav');
  const tApp = useTranslations('app');
  const locale = useLocale();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sections = filterNavigation(permissions);
  const allItems = sections.flatMap((section) => section.items);
  const primaryItems = MOBILE_PRIMARY_KEYS.map((key) =>
    allItems.find((item) => item.key === key),
  ).filter(Boolean) as NavItem[];

  // Close the drawer on navigation — leaving it open over the new page is a
  // classic mobile bug.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 start-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-e border-border bg-surface-1 lg:flex"
        aria-label={t('sections.main')}
      >
        <div className="flex h-[var(--topbar-height)] items-center gap-2 border-b border-border px-3">
          <StoreSwitcher
            stores={stores}
            activeStore={activeStore}
            onSwitchStore={onSwitchStore}
            locale={locale}
          />
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
          {sections.map((section) => (
            <div key={section.key} className="mb-4 last:mb-0">
              <p className="px-2 pb-1.5 text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                {t(`sections.${section.key}`)}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.key}>
                    <SidebarLink item={item} pathname={pathname} locale={locale} label={t(item.key)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <Link
            href={`/${locale}/${activeStore.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-[var(--radius)] px-2.5 py-2 text-[13px] text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t('viewStore')}
          </Link>
        </div>
      </aside>

      {/* Topbar */}
      <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center gap-2 border-b border-border bg-surface-1/95 px-3 backdrop-blur lg:ps-[calc(var(--sidebar-width)+0.75rem)]">
        <IconButton
          label={tApp('openMenu')}
          icon={<Menu />}
          size="touch"
          className="lg:hidden"
          onClick={() => setDrawerOpen(true)}
        />

        <div className="lg:hidden">
          <StoreSwitcher
            stores={stores}
            activeStore={activeStore}
            onSwitchStore={onSwitchStore}
            locale={locale}
            compact
          />
        </div>

        <div className="hidden flex-1 lg:block" />

        <div className="ms-auto flex items-center gap-1">
          <IconButton
            label={tApp('search')}
            icon={<Search />}
            className="hidden sm:inline-flex"
            disabled
            title={tApp('search')}
          />

          <Link
            href={`/${locale}/dashboard/notifications`}
            className="relative inline-flex size-9 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
            aria-label={tApp('notifications')}
          >
            <Bell className="size-4" aria-hidden />
            {notificationCount > 0 ? (
              <span className="absolute -top-0.5 inset-inline-end-0 end-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium leading-4 text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            ) : null}
          </Link>

          <ThemeToggle />
          <LocaleToggle />
          <UserMenu user={user} roleKey={roleKey} locale={locale} onLogout={onLogout} />
        </div>
      </header>

      {/* Main */}
      <main
        id="main"
        className="px-3 pb-[calc(var(--bottom-nav-height)+1.5rem)] pt-4 sm:px-4 lg:ps-[calc(var(--sidebar-width)+1rem)] lg:pe-4 lg:pb-8"
      >
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex h-[var(--bottom-nav-height)] items-stretch border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label={t('sections.main')}
      >
        {primaryItems.map((item) => {
          const active = isNavActive(item, pathname);
          return (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium',
                'transition-colors duration-fast',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon name={item.icon} className="size-5" />
              <span className="truncate">{t(item.key)}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-muted-foreground transition-colors duration-fast"
        >
          <Menu className="size-5" aria-hidden />
          <span className="truncate">{tApp('more')}</span>
        </button>
      </nav>

      {/* Expanded navigation drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent title={activeStore.name} description={t('switchStore')} side="inline-start">
          <nav aria-label={tApp('more')}>
            {sections.map((section) => (
              <div key={section.key} className="mb-4 last:mb-0">
                <p className="pb-1.5 text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                  {t(`sections.${section.key}`)}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.key}>
                      <SidebarLink
                        item={item}
                        pathname={pathname}
                        locale={locale}
                        label={t(item.key)}
                        touch
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <Link
            href={`/${locale}/${activeStore.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2.5 text-[13px] text-muted-foreground"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t('viewStore')}
          </Link>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarLink({
  item,
  pathname,
  locale,
  label,
  touch,
}: {
  item: NavItem;
  pathname: string;
  locale: string;
  label: string;
  touch?: boolean;
}) {
  const active = isNavActive(item, pathname);

  return (
    <Link
      href={`/${locale}${item.href}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-[var(--radius)] px-2.5 text-[13px] transition-colors duration-fast',
        touch ? 'min-h-11 py-2.5' : 'py-2',
        active
          ? 'bg-[var(--primary-soft)] font-medium text-primary'
          : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
      )}
    >
      <Icon name={item.icon} className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function StoreSwitcher({
  stores,
  activeStore,
  onSwitchStore,
  locale,
  compact,
}: {
  stores: ShellStore[];
  activeStore: ShellStore;
  onSwitchStore: (storeId: string) => void;
  locale: string;
  compact?: boolean;
}) {
  const t = useTranslations('nav');

  if (stores.length <= 1) {
    return (
      <div className={cn('flex min-w-0 items-center gap-2', compact && 'max-w-[40vw]')}>
        <StoreAvatar store={activeStore} />
        <span className="truncate text-[13px] font-medium text-foreground">{activeStore.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-[var(--radius)] px-1.5 py-1.5 transition-colors duration-fast hover:bg-surface-2',
          compact && 'max-w-[40vw]',
        )}
      >
        <StoreAvatar store={activeStore} />
        <span className="truncate text-[13px] font-medium text-foreground">{activeStore.name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t('switchStore')}</DropdownMenuLabel>
        {stores.map((store) => (
          <DropdownMenuItem key={store.id} onSelect={() => onSwitchStore(store.id)}>
            <StoreAvatar store={store} />
            <span className="truncate">{store.name}</span>
            {store.id === activeStore.id ? (
              <span className="ms-auto size-1.5 rounded-full bg-primary" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/${activeStore.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink />
            {t('viewStore')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StoreAvatar({ store }: { store: ShellStore }) {
  if (store.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- merchant logos are arbitrary remote URLs
      <img
        src={store.logoUrl}
        alt=""
        className="size-6 shrink-0 rounded-[var(--radius-sm)] object-cover"
      />
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary-soft)] text-primary">
      <Store className="size-3.5" aria-hidden />
    </span>
  );
}

function UserMenu({
  user,
  roleKey,
  locale,
  onLogout,
}: {
  user: { fullName: string; email: string; avatarUrl: string | null };
  roleKey: string;
  locale: string;
  onLogout: () => void;
}) {
  const t = useTranslations('app');
  const tStaff = useTranslations('staff');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-xs font-medium text-foreground transition-colors duration-fast hover:bg-[var(--border)]"
        aria-label={t('profile')}
      >
        {initials(user.fullName)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-[13px] font-medium text-foreground">{user.fullName}</p>
          <p className="truncate text-xs text-subtle-foreground">{user.email}</p>
          <p className="mt-1 text-2xs text-subtle-foreground">{tStaff(`roleNames.${roleKey}`)}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/dashboard/profile`}>
            <User />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={onLogout}>
          <LogOut />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');
}

function ThemeToggle() {
  const t = useTranslations('app');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'light' || current === 'dark') setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('akd-theme', next);
    } catch {
      // Private browsing blocks storage; the toggle still works for this session.
    }
  };

  return (
    <IconButton
      label={theme === 'dark' ? t('themeLight') : t('themeDark')}
      icon={theme === 'dark' ? <Sun /> : <Moon />}
      onClick={toggle}
      className="hidden sm:inline-flex"
    />
  );
}

function LocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === 'ar' ? 'en' : 'ar';

  return (
    <Link
      href={`/${other}${stripLocale(pathname)}`}
      className="inline-flex h-9 items-center justify-center rounded-[var(--radius)] px-2 text-xs font-medium text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
      aria-label={other === 'ar' ? 'العربية' : 'English'}
    >
      {other === 'ar' ? 'ع' : 'EN'}
    </Link>
  );
}
