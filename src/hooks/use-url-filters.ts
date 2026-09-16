'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

/**
 * URL-synced filter state.
 *
 * Filters live in the query string, so refresh, browser back and a shared link
 * all reproduce the same view. Changing a filter resets the page number —
 * staying on page 7 of a result set that now has two pages shows an empty
 * screen and looks like a bug.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const setFilters = useCallback(
    (updates: Record<string, string | number | null | undefined>, options?: { keepPage?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }

      if (!options?.keepPage && !('page' in updates)) next.delete('page');

      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const reset = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [pathname, router]);

  const get = useCallback((key: string) => params.get(key) ?? '', [params]);

  /** Filter keys that are set, ignoring paging and sorting. */
  const activeCount = useMemo(() => {
    let count = 0;
    params.forEach((value, key) => {
      if (value && !['page', 'perPage', 'sort'].includes(key)) count += 1;
    });
    return count;
  }, [params]);

  return { get, setFilters, reset, activeCount, isPending, params };
}

/**
 * Debounced search box state.
 *
 * Typing "0912" should issue one request, not four. The value updates the URL
 * only after the merchant stops typing; a new keystroke cancels the pending
 * update, so a stale request can never overwrite a newer one.
 */
export function useDebouncedFilter(
  key: string,
  delayMs = 350,
): [string, (value: string) => void, boolean] {
  const { get, setFilters, isPending } = useUrlFilters();
  const urlValue = get(key);
  const [value, setValue] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // Keep in sync when the URL changes from elsewhere (reset, back button).
  useEffect(() => {
    if (!dirty.current) setValue(urlValue);
  }, [urlValue]);

  const update = useCallback(
    (next: string) => {
      dirty.current = true;
      setValue(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        dirty.current = false;
        setFilters({ [key]: next || null });
      }, delayMs);
    },
    [delayMs, key, setFilters],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return [value, update, isPending];
}
