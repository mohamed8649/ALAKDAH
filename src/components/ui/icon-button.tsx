'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

const iconButtonVariants = cva(
  cn(
    'inline-flex items-center justify-center shrink-0',
    'rounded-[var(--radius)] transition-colors duration-fast',
    'disabled:pointer-events-none disabled:opacity-50',
  ),
  {
    variants: {
      variant: {
        ghost: 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        outline: 'border border-border text-foreground hover:bg-surface-2',
        solid: 'bg-surface-3 text-foreground hover:bg-[var(--border)]',
        danger: 'text-danger hover:bg-[var(--danger-soft)]',
        primary: 'bg-primary text-[var(--primary-foreground)] hover:bg-primary-hover',
      },
      size: {
        sm: 'size-7 [&_svg]:size-3.5',
        md: 'size-9 [&_svg]:size-4',
        /** 44px minimum touch target. */
        touch: 'size-11 [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  /** Required: an icon-only control must expose an accessible name. */
  label: string;
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size, label, icon, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {icon}
    </button>
  );
});
