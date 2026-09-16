/**
 * Client-safe identifier generation.
 *
 * Deliberately separate from src/lib/crypto.ts, which imports node:crypto and
 * must never reach the browser bundle. The only thing a client needs is an
 * unguessable-enough idempotency key for a form submission; `crypto.randomUUID`
 * is available in every browser we support, with a fallback for insecure
 * contexts where the Web Crypto API is absent.
 */
export function clientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Last resort. Uniqueness here only has to hold within one browser tab, which
  // is all an idempotency key for a single form submission needs.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
