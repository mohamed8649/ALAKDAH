'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Sheet / drawer.
 *
 * `side="inline-start"` and `"inline-end"` follow the document direction, so
 * the navigation drawer opens from the right in Arabic and the left in English
 * without a per-component RTL branch.
 */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export type SheetSide = 'inline-start' | 'inline-end' | 'bottom';

export interface SheetContentProps
  extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  side?: SheetSide;
  footer?: ReactNode;
  width?: string;
}

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent(
  { className, title, description, side = 'inline-end', footer, width = 'sm:max-w-md', children, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col bg-surface-1 shadow-overlay',
          'transition-transform duration-base ease-out',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-xl)] border-t border-border data-[state=open]:animate-slide-up'
            : 'inset-y-0 w-[88vw] max-w-sm',
          side === 'inline-start' && 'start-0 border-e border-border',
          side === 'inline-end' && 'end-0 border-s border-border',
          side !== 'bottom' && width,
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            className="-me-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
            aria-label="إغلاق"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
