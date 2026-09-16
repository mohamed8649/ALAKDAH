'use client';

import { useEffect, useState } from 'react';

import { formatDateTime, formatRelative } from '@/lib/datetime';

/**
 * A timestamp shown as "3 minutes ago".
 *
 * Relative time cannot be server-rendered. It is computed from `Date.now()`,
 * so the server produces "5 seconds ago", the browser hydrates a moment later
 * and computes "6 seconds ago", and React throws the whole subtree away and
 * re-renders it — logging a hydration error in every merchant's console on
 * every list in the product.
 *
 * So the first render, on both sides, is the absolute time formatted in the
 * store's timezone, which is identical everywhere. The relative label replaces
 * it after mount, and the absolute time stays in the `title` for anyone who
 * needs the exact moment.
 */
export function RelativeTime({
  value,
  locale,
  timezone,
  className,
}: {
  value: Date | string;
  locale: string;
  timezone?: string;
  className?: string;
}) {
  const absolute = formatDateTime(value, locale, timezone);
  const [label, setLabel] = useState(absolute);

  useEffect(() => {
    setLabel(formatRelative(value, locale));

    // Re-computed every half minute so a queue left open does not keep
    // claiming an order arrived "just now" twenty minutes later.
    const timer = setInterval(() => setLabel(formatRelative(value, locale)), 30_000);
    return () => clearInterval(timer);
  }, [value, locale]);

  return (
    <time
      dateTime={typeof value === 'string' ? value : value.toISOString()}
      title={absolute}
      className={className}
    >
      {label}
    </time>
  );
}
