'use client';

import { AlertCircle } from 'lucide-react';

/**
 * Top-of-form error banner.
 *
 * `role="alert"` so a screen reader announces a failed submit. Used only for
 * errors that are not attached to a specific field — a field error belongs
 * beside its input.
 */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function FormSuccess({ message }: { message: string | null | undefined }) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="rounded-[var(--radius)] border border-[var(--success)]/30 bg-[var(--success-soft)] px-3 py-2.5 text-[13px] text-success"
    >
      {message}
    </div>
  );
}
