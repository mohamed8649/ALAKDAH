import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Page header.
 *
 * One primary action per screen, in a predictable place. On mobile the actions
 * wrap below the title rather than shrinking the title to fit.
 */
export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
  breadcrumbs,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn('mb-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="مسار التنقل" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-subtle-foreground">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? (
                  // Chevron mirrors with the document direction.
                  <ChevronLeft className="rtl-flip size-3" aria-hidden />
                ) : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="transition-colors duration-fast hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {backHref ? (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-fast hover:text-foreground"
        >
          <ChevronLeft className="rtl-flip size-3.5" aria-hidden />
          {backLabel}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
          {description ? (
            <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}
