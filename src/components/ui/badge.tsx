import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-2xs font-medium leading-4 whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-3 text-muted-foreground',
        primary: 'bg-[var(--primary-soft)] text-primary',
        success: 'bg-[var(--success-soft)] text-success',
        warning: 'bg-[var(--warning-soft)] text-warning',
        danger: 'bg-[var(--danger-soft)] text-danger',
        info: 'bg-[var(--info-soft)] text-info',
        accent: 'bg-[var(--accent-soft)] text-accent',
        outline: 'border border-border text-muted-foreground',
      },
      size: {
        sm: 'text-2xs px-1.5 py-0.5',
        md: 'text-xs px-2 py-1',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  icon?: ReactNode;
}

export function Badge({ className, tone, size, dot, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {icon}
      {children}
    </span>
  );
}
