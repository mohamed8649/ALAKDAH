'use client';

import { AlertCircle } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

/**
 * Form field primitives.
 *
 * `Field` owns the id wiring so every control has a real <label>, and every
 * error message is associated with its input through aria-describedby and
 * aria-invalid. Errors are inline — a validation problem the merchant has to
 * fix never lives in a toast that disappears.
 */

interface FieldContextValue {
  id: string;
  errorId: string;
  hintId: string;
  hasError: boolean;
  hasHint: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optionalLabel?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  optionalLabel,
  className,
  children,
}: FieldProps) {
  const base = useId();
  const value: FieldContextValue = {
    id: `${base}-control`,
    errorId: `${base}-error`,
    hintId: `${base}-hint`,
    hasError: Boolean(error),
    hasHint: Boolean(hint),
  };

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label ? (
          <label htmlFor={value.id} className="text-[13px] font-medium text-foreground">
            {label}
            {required ? (
              <span className="text-danger ms-1" aria-hidden>
                *
              </span>
            ) : optionalLabel ? (
              <span className="text-subtle-foreground ms-1.5 font-normal">({optionalLabel})</span>
            ) : null}
          </label>
        ) : null}

        {children}

        {hint && !error ? (
          <p id={value.hintId} className="text-xs text-subtle-foreground">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p id={value.errorId} className="flex items-center gap-1.5 text-xs text-danger">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldAria() {
  const context = useContext(FieldContext);
  if (!context) return {};
  const describedBy = [
    context.hasError ? context.errorId : null,
    context.hasHint && !context.hasError ? context.hintId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: context.id,
    'aria-invalid': context.hasError || undefined,
    'aria-describedby': describedBy || undefined,
  };
}

const controlClasses = cn(
  'w-full rounded-[var(--radius)] border border-border bg-[var(--input)] text-foreground',
  'px-3 text-sm placeholder:text-subtle-foreground',
  'transition-colors duration-fast',
  'hover:border-border-strong',
  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-[var(--danger)]',
);

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  /** Adornment rendered at the inline-start edge (currency, unit). */
  adornStart?: ReactNode;
  adornEnd?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, adornStart, adornEnd, ...props },
  ref,
) {
  const aria = useFieldAria();

  if (adornStart || adornEnd) {
    return (
      <div
        className={cn(
          'flex h-9 items-center rounded-[var(--radius)] border border-border bg-[var(--input)]',
          'focus-within:border-primary focus-within:ring-1 focus-within:ring-[var(--focus-ring)]',
          aria['aria-invalid'] && 'border-danger',
          className,
        )}
      >
        {adornStart ? (
          <span className="ps-3 text-xs text-subtle-foreground shrink-0">{adornStart}</span>
        ) : null}
        <input
          ref={ref}
          className="h-full w-full bg-transparent px-3 text-sm text-foreground placeholder:text-subtle-foreground focus:outline-none"
          {...aria}
          {...props}
        />
        {adornEnd ? (
          <span className="pe-3 text-xs text-subtle-foreground shrink-0">{adornEnd}</span>
        ) : null}
      </div>
    );
  }

  return <input ref={ref} className={cn(controlClasses, 'h-9', className)} {...aria} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    const aria = useFieldAria();
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(controlClasses, 'py-2 leading-relaxed resize-y', className)}
        {...aria}
        {...props}
      />
    );
  },
);

export interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

/**
 * Native select. Used wherever the option list is short and a native mobile
 * picker beats a custom popover — which on a phone is most of the time.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(
  { className, children, ...props },
  ref,
) {
  const aria = useFieldAria();
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlClasses, 'h-9 appearance-none pe-8', className)}
        {...aria}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute inset-inline-end-0 end-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
});
