'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Buttons are real <button> elements. An element that performs an action is
 * never a styled <div>: keyboard users, screen readers and form submission all
 * depend on the real element.
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'rounded-[var(--radius)] transition-colors duration-fast',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-[var(--primary-foreground)] hover:bg-primary-hover active:bg-primary-active',
        secondary:
          'bg-surface-3 text-foreground hover:bg-[var(--border)] border border-border',
        outline:
          'border border-border-strong bg-transparent text-foreground hover:bg-surface-2',
        ghost: 'bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        danger: 'bg-danger text-white hover:opacity-90 active:opacity-100',
        'danger-ghost': 'bg-transparent text-danger hover:bg-[var(--danger-soft)]',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
        md: 'h-9 px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 px-5 text-[15px] [&_svg]:size-[18px]',
        /** Meets the 44px minimum touch target on mobile primary actions. */
        touch: 'h-11 px-5 text-[15px] min-w-11 [&_svg]:size-[18px]',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild = false, loading = false, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

export { buttonVariants };
