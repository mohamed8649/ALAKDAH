'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

/**
 * Section navigation.
 *
 * Nested tabs for a module with several screens (shipping, settings, call
 * center). Scrolls horizontally on a phone rather than wrapping — the reference
 * does the same with its status row, and wrapped tabs waste vertical space on a
 * small screen.
 */
export function SubNav({
  items,
}: {
  items: Array<{ href: string; label: string; badge?: number }>;
}) {
  const pathname = usePathname();

  return (
    <nav className="hide-scrollbar -mx-3 flex gap-1 overflow-x-auto border-b border-border px-3 sm:mx-0 sm:px-0">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium',
              'transition-colors duration-fast',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 ? (
              <span className="rounded-full bg-surface-3 px-1.5 text-2xs tabular-nums text-muted-foreground">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
