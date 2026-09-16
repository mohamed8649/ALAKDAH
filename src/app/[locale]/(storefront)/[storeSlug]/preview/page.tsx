import { notFound } from 'next/navigation';
import { Package, Store } from 'lucide-react';
import type { Metadata } from 'next';

import { TrustBadgeRow } from '@/features/storefront/trust-badges';
import { getTranslations } from '@/i18n/server';
import { formatMoney } from '@/lib/money';
import {
  getTheme,
  resolveThemeTokens,
  themeCssVariables,
  DEFAULT_THEME_KEY,
} from '@/server/catalog/themes';
import { getStorefront, listStorefrontProducts } from '@/server/services/storefront-service';
import { listTrustBadges } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'معاينة القالب', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Theme preview.
 *
 * Isolated from the live storefront: it renders the merchant's real products
 * under a *candidate* theme's tokens, chosen from the query string. Nothing
 * here writes, and the published shop is unaffected — which is the whole point
 * of previewing before activating.
 *
 * This route exists because a Next.js layout cannot read search params, so the
 * live storefront layout has no way to apply a per-request theme override.
 */
export default async function ThemePreviewPage({
  params,
  searchParams,
}: {
  params: { locale: string; storeSlug: string };
  searchParams: { theme?: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const themeKey = searchParams.theme && getTheme(searchParams.theme)
    ? searchParams.theme
    : store.themeKey;

  const theme = getTheme(themeKey) ?? getTheme(DEFAULT_THEME_KEY)!;
  const tokens = resolveThemeTokens(themeKey, null);
  const cssVariables = themeCssVariables(tokens) as React.CSSProperties;

  const [{ items }, badges] = await Promise.all([
    listStorefrontProducts(store.id, { limit: 6 }),
    listTrustBadges(store.id, true),
  ]);

  const t = getTranslations(params.locale, 'storefront');
  const sections = theme.sections.filter((section) => section.enabled).map((s) => s.key);

  const gridCols =
    theme.sections.find((s) => s.key === 'product_grid')?.variant === 'grid-4'
      ? 'grid-cols-2 sm:grid-cols-4'
      : theme.sections.find((s) => s.key === 'product_grid')?.variant === 'grid-2'
        ? 'grid-cols-2'
        : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="storefront-scope min-h-dvh bg-background text-foreground" style={cssVariables}>
      {sections.includes('announcement') ? (
        <div className="bg-primary px-4 py-2 text-center text-xs font-medium text-[var(--primary-foreground)]">
          {store.announcementText || store.name}
        </div>
      ) : null}

      <header className="flex h-14 items-center gap-2 border-b border-border px-4">
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- merchant logo
          <img src={store.logoUrl} alt="" className="h-8 w-auto object-contain" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-[var(--radius)] bg-[var(--primary-soft)] text-primary">
            <Store className="size-4" aria-hidden />
          </span>
        )}
        <span className="text-sm font-semibold">{store.name}</span>
      </header>

      {sections.includes('hero') ? (
        <section className="border-b border-border bg-surface-2 px-5 py-10 text-center">
          <h1 className="text-xl font-semibold">{store.name}</h1>
          {store.description ? (
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{store.description}</p>
          ) : null}
          <span
            className="mt-5 inline-block bg-primary px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
            style={{
              borderRadius:
                theme.tokens.buttonStyle === 'pill'
                  ? '999px'
                  : theme.tokens.buttonStyle === 'square'
                    ? '0'
                    : tokens.radius,
            }}
          >
            {t('products')}
          </span>
        </section>
      ) : null}

      {sections.includes('trust') && badges.length > 0 ? (
        <div className="px-4 py-5">
          <TrustBadgeRow
            badges={badges.map((badge) => ({
              id: badge.id,
              title: badge.title,
              description: badge.description,
              icon: badge.icon,
            }))}
          />
        </div>
      ) : null}

      {sections.includes('product_grid') ? (
        <section className="px-4 py-6">
          <h2 className="mb-3 text-sm font-semibold">{t('products')}</h2>
          <ul className={`grid gap-3 ${gridCols}`}>
            {items.map((product) => (
              <li
                key={product.id}
                className="overflow-hidden border border-border bg-surface-1"
                style={{
                  borderRadius: tokens.radius,
                  boxShadow: theme.tokens.cardStyle === 'raised' ? 'var(--shadow-card)' : 'none',
                }}
              >
                <div className="aspect-square bg-surface-3">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- merchant upload
                    <img src={product.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-subtle-foreground">
                      <Package className="size-6" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs">{product.name}</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums">
                    {formatMoney(product.price, store.currency, params.locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-border bg-surface-2 px-4 py-6 text-center text-2xs text-muted-foreground">
        © {new Date().getFullYear()} {store.name}
      </footer>
    </div>
  );
}
