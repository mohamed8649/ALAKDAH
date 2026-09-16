import type { ZodError } from 'zod';

import type { FieldErrors } from '@/lib/errors';

/**
 * Flatten a Zod error into the field-error shape the forms consume.
 *
 * Messages are i18n keys ("validation.required"), not sentences: the server
 * does not know the merchant's language, and the client already does.
 */
export function zodFieldErrors(error: ZodError): FieldErrors {
  const result: FieldErrors = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_form';
    (result[path] ??= []).push(issue.message);
  }

  return result;
}
