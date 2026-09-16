import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CartProvider } from '@/features/storefront/cart-store';
import { QuickContact } from '@/features/storefront/quick-contact';
import { StorefrontHeader } from '@/features/storefront/storefront-header';
import { getTranslations } from '@/i18n/server';
import { themeCssVariables } from '@/server/catalog/themes';
import { getStorefront, listStorefrontCollections } from '@/server/services/storefront-service';

export async function generateMetadata({
  params,
}: {
  params: { storeSlug: string };
}): Promise<Metadata> {
  const store = await getStorefront(params.storeSlug);
  if (!store) return { title: 'المتجر غير موجود' };

  return {
    title: { default: store.name, template: `%s — ${store.name}` },
    description: store.description ?? undefined,
    icons: store.faviconUrl ? { icon: store.faviconUrl } : undefined,
    openGraph: { title: store.name, description: store.description ?? undefined },
  };
}

/**
 * Storefront layout.
 *
 * A different product from the dashboard, not the same shell recoloured: light
 * surface, the merchant's own theme tokens, no admin navigation. Theme tokens
 * are injected as inline CSS variables on a scoping element, so a theme switch
 * restyles the whole shop without shipping per-store CSS.
 */
export default async function StorefrontLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string; storeSlug: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const collections = await listStorefrontCollections(store.id);
  const t = getTranslations(params.locale, 'storefront');

  // React accepts custom properties in the style object, so the theme's tokens
  // become real CSS variables scoped to this subtree.
  const cssVariables = themeCssVariables(store.tokens) as React.CSSProperties;

  return (
    <CartProvider storeSlug={store.slug}>
      <div
        className="storefront-scope flex min-h-dvh flex-col bg-background text-foreground"
        style={cssVariables}
      >
        {store.announcementEnabled && store.announcementText ? (
          <div className="bg-primary px-4 py-2 text-center text-xs font-medium text-[var(--primary-foreground)]">
            {store.announcementText}
          </div>
        ) : null}

        <StorefrontHeader
          store={{ slug: store.slug, name: store.name, logoUrl: store.logoUrl }}
          locale={params.locale}
          cartEnabled={store.settings.cartEnabled}
          collections={collections.map((collection) => ({
            handle: collection.handle,
            title: collection.title,
          }))}
        />

        <main className="flex-1">{children}</main>

        <footer className="mt-10 border-t border-border bg-surface-2">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{store.name}</p>
                {store.description ? (
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    {store.description}
                  </p>
                ) : null}
              </div>

              <nav className="flex flex-col gap-1.5 text-xs" aria-label={t('home')}>
                <Link
                  href={`/${params.locale}/${store.slug}/products`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t('products')}
                </Link>
                {store.settings.trackingEnabled ? (
                  <Link
                    href={`/${params.locale}/${store.slug}/track`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t('track')}
                  </Link>
                ) : null}
              </nav>

              {(store.instagram || store.facebook || store.tiktok) ? (
                <ul className="flex gap-3 text-xs">
                  {store.instagram ? (
                    <li>
                      <a
                        href={store.instagram}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Instagram
                      </a>
                    </li>
                  ) : null}
                  {store.facebook ? (
                    <li>
                      <a
                        href={store.facebook}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Facebook
                      </a>
                    </li>
                  ) : null}
                  {store.tiktok ? (
                    <li>
                      <a
                        href={store.tiktok}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        TikTok
                      </a>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            <p className="mt-6 border-t border-border pt-4 text-center text-2xs text-subtle-foreground">
              © {new Date().getFullYear()} {store.name}
            </p>
          </div>
        </footer>

        <QuickContact
          phone={
            store.settings.quickContactPhoneEnabled ? store.settings.quickContactPhone : null
          }
          whatsapp={
            store.settings.quickContactWhatsappEnabled ? store.settings.quickContactWhatsapp : null
          }
          country={store.country}
        />
      </div>
    </CartProvider>
  );
}
