'use client';

import Link from 'next/link';
import { Menu, Search, ShoppingCart, Store, X } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/field';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useTranslations } from '@/i18n/provider';
import { cn } from '@/lib/cn';

import { useCart } from './cart-store';

/**
 * Storefront header.
 *
 * The cart badge only renders after hydration: rendering a count from
 * localStorage during SSR would mismatch, and showing "0" then flashing to "3"
 * is worse than showing nothing for one frame.
 */
export function StorefrontHeader({
  store,
  locale,
  cartEnabled,
  collections,
}: {
  store: { slug: string; name: string; logoUrl: string | null };
  locale: string;
  cartEnabled: boolean;
  collections: Array<{ handle: string; title: string }>;
}) {
  const t = useTranslations('storefront');
  const { count, hydrated } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const base = `/${locale}/${store.slug}`;

  const links = [
    { href: base, label: t('home') },
    { href: `${base}/products`, label: t('products') },
    ...collections.slice(0, 4).map((collection) => ({
      href: `${base}/collections/${collection.handle}`,
      label: collection.title,
    })),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface-1/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <IconButton
          label={t('products')}
          icon={<Menu />}
          size="touch"
          className="md:hidden"
          onClick={() => setMenuOpen(true)}
        />

        <Link href={base} className="flex min-w-0 items-center gap-2">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- merchant logo is an arbitrary path
            <img src={store.logoUrl} alt="" className="h-8 w-auto max-w-32 object-contain" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--primary-soft)] text-primary">
              <Store className="size-4" aria-hidden />
            </span>
          )}
          <span className="truncate text-sm font-semibold text-foreground">{store.name}</span>
        </Link>

        <nav className="ms-6 hidden flex-1 items-center gap-1 md:flex" aria-label={t('products')}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius)] px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <IconButton
            label={t('search')}
            icon={searchOpen ? <X /> : <Search />}
            size="touch"
            onClick={() => setSearchOpen((open) => !open)}
          />

          {cartEnabled ? (
            <Link
              href={`${base}/cart`}
              className="relative inline-flex size-11 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
              aria-label={t('cart')}
            >
              <ShoppingCart className="size-5" aria-hidden />
              {hydrated && count > 0 ? (
                <span className="absolute top-1 inset-inline-end-0 end-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-[var(--primary-foreground)]">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </Link>
          ) : null}
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-border px-4 py-2">
          <form action={`${base}/products`} className="mx-auto max-w-6xl">
            <Input
              name="q"
              autoFocus
              placeholder={t('searchPlaceholder')}
              aria-label={t('search')}
            />
          </form>
        </div>
      ) : null}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent title={store.name} side="inline-start">
          <nav aria-label={t('products')}>
            <ul className="space-y-0.5">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex min-h-11 items-center rounded-[var(--radius)] px-3 text-sm',
                      'text-foreground transition-colors duration-fast hover:bg-surface-2',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`${base}/track`}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-[var(--radius)] px-3 text-sm text-foreground transition-colors duration-fast hover:bg-surface-2"
                >
                  {t('track')}
                </Link>
              </li>
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
