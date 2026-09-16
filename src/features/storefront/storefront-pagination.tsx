import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Storefront pagination.
 *
 * Real anchors rather than buttons: a shopper's page position should be
 * shareable, crawlable and restorable with the back button.
 */
export function StorefrontPagination({
  page,
  pageCount,
  basePath,
  query,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  query: Record<string, string>;
}) {
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams(query);
    if (target > 1) params.set('page', String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="pagination">
      <PageLink href={href(page - 1)} disabled={page <= 1}>
        <ChevronRight className="rtl-flip size-4" aria-hidden />
      </PageLink>

      <span className="px-2 text-xs tabular-nums text-muted-foreground">
        {page} / {pageCount}
      </span>

      <PageLink href={href(page + 1)} disabled={page >= pageCount}>
        <ChevronLeft className="rtl-flip size-4" aria-hidden />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    'flex size-10 items-center justify-center rounded-[var(--radius)] border border-border',
    disabled
      ? 'pointer-events-none opacity-40'
      : 'text-foreground transition-colors duration-fast hover:bg-surface-2',
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
