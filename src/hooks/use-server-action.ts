'use client';

import { useCallback, useRef, useState } from 'react';

import type { ActionResult, FieldErrors } from '@/lib/errors';
import { useTranslations } from '@/i18n/provider';

/**
 * Calling a server action from a form.
 *
 * Covers the states every form in this product needs: submitting, a translated
 * top-level error, and per-field errors returned by the server. It also
 * guarantees a mutation runs once per click — a second submit while the first
 * is in flight is dropped, so a double-click cannot create two orders.
 */
export function useServerAction<TInput, TData>(
  action: (input: TInput) => Promise<ActionResult<TData>>,
) {
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const inFlight = useRef(false);

  const run = useCallback(
    async (input: TInput): Promise<TData | null> => {
      if (inFlight.current) return null;

      inFlight.current = true;
      setSubmitting(true);
      setError(null);
      setFieldErrors({});

      try {
        const result = await action(input);

        if (result.ok) return result.data;

        setFieldErrors(result.error.fieldErrors ?? {});
        // VALIDATION_FAILED with field errors is already shown inline; a
        // duplicate banner just repeats what the fields say.
        if (result.error.code !== 'VALIDATION_FAILED' || !result.error.fieldErrors) {
          setError(tErrors(result.error.code));
        }
        return null;
      } catch {
        setError(tErrors('networkError'));
        return null;
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [action, tErrors],
  );

  /** Translate the first error for a field, if any. */
  const fieldError = useCallback(
    (name: string): string | null => {
      const messages = fieldErrors[name];
      if (!messages || messages.length === 0) return null;
      const key = messages[0]!;
      // Server messages are i18n keys; anything else is passed through.
      return key.includes('.') ? tValidation(key) : key;
    },
    [fieldErrors, tValidation],
  );

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  return { run, submitting, error, fieldError, fieldErrors, setError, reset };
}
