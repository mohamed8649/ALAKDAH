import { Icon } from '@/components/layout/icon';

/**
 * Trust badges.
 *
 * Icon and text only — a merchant picks from a fixed icon set and writes their
 * own copy. No HTML or script is accepted here, so a badge can never become an
 * injection point on the storefront.
 */
export function TrustBadgeRow({
  badges,
}: {
  badges: Array<{ id: string; title: string; description: string | null; icon: string }>;
}) {
  if (badges.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] border border-border bg-surface-2 p-4 sm:grid-cols-4">
      {badges.map((badge) => (
        <li key={badge.id} className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-primary">
            <Icon name={badge.icon} className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{badge.title}</p>
            {badge.description ? (
              <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                {badge.description}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
