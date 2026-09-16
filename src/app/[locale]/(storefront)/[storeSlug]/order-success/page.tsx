import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/server';
import { getStorefront } from '@/server/services/storefront-service';

export const metadata: Metadata = { title: 'تم الطلب', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Thank-you page.
 *
 * The message, button label and destination are all merchant-configurable. The
 * order number comes from the query string and is only ever displayed — no
 * order data is fetched here, so the page reveals nothing to someone who edits
 * the URL.
 */
export default async function OrderSuccessPage({
  params,
  searchParams,
}: {
  params: { locale: string; storeSlug: string };
  searchParams: { order?: string };
}) {
  const store = await getStorefront(params.storeSlug);
  if (!store) notFound();

  const t = getTranslations(params.locale, 'storefront.thankYou');
  const tStorefront = getTranslations(params.locale, 'storefront');
  const settings = store.settings;
  const base = `/${params.locale}/${store.slug}`;

  const orderNumber = (searchParams.order ?? '').slice(0, 20);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--primary-soft)] text-primary">
        <CheckCircle2 className="size-7" aria-hidden />
      </span>

      <h1 className="text-xl font-semibold text-foreground">
        {settings.thankYouEnabled && settings.thankYouTitle ? settings.thankYouTitle : t('title')}
      </h1>

      {orderNumber ? (
        <p className="mt-2 font-mono text-sm text-muted-foreground" dir="ltr">
          {t('orderNumber', { number: orderNumber })}
        </p>
      ) : null}

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {settings.thankYouEnabled && settings.thankYouMessage
          ? settings.thankYouMessage
          : t('default')}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {settings.thankYouEnabled && settings.thankYouButtonText ? (
          <Button asChild variant="primary" size="touch">
            {/* A merchant-supplied destination stays inside their own store
                unless they gave an absolute URL. */}
            <Link href={settings.thankYouButtonUrl || `${base}/products`}>
              {settings.thankYouButtonText}
            </Link>
          </Button>
        ) : (
          <Button asChild variant="primary" size="touch">
            <Link href={`${base}/products`}>{tStorefront('continueShopping')}</Link>
          </Button>
        )}

        {settings.trackingEnabled ? (
          <Button asChild variant="outline" size="touch">
            <Link href={`${base}/track${orderNumber ? `?order=${orderNumber}` : ''}`}>
              {t('trackOrder')}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
