'use client';

import { useEffect } from 'react';

/**
 * Warn before losing unsaved work.
 *
 * The browser's native beforeunload prompt covers reloads, tab closes and
 * external links. In-app navigation is handled by the editor's own state — the
 * sticky action bar shows the unsaved marker, which is the honest signal for a
 * client-side route change (the App Router gives no reliable way to intercept
 * one, and faking it with link hijacking breaks back/forward).
 */
export function useUnsavedChanges(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Browsers ignore custom text and show their own message; assigning
      // returnValue is what actually triggers the prompt.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
}
