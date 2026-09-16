import { Check, Package } from 'lucide-react';

import { TrustBadgeRow } from '@/features/storefront/trust-badges';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

import type { PageBlock } from './blocks';

/**
 * Block renderer.
 *
 * Maps a known block type to a known component. Nothing here evaluates stored
 * strings as markup: every text value renders as text, and the only embeds
 * permitted are YouTube and Vimeo built from a validated id.
 */

export interface RenderContext {
  currency: string;
  locale: string;
  badges: Array<{ id: string; title: string; description: string | null; icon: string }>;
  products: Record<
    string,
    { id: string; name: string; slug: string; price: number; imageUrl: string | null }
  >;
  /** Rendered in place of the order form inside the builder preview. */
  orderFormSlot?: React.ReactNode;
}

export function BlockRenderer({
  block,
  context,
}: {
  block: PageBlock;
  context: RenderContext;
}) {
  const props = block.props as Record<string, never>;

  switch (block.type) {
    case 'hero': {
      const { headline, subheadline, imageUrl, ctaText, align } = props as unknown as {
        headline: string;
        subheadline: string;
        imageUrl: string | null;
        ctaText: string;
        align: string;
      };

      return (
        <section
          className={cn(
            'px-4 py-10 sm:py-14',
            align === 'center' ? 'text-center' : 'text-start',
          )}
        >
          <div className="mx-auto max-w-3xl">
            {headline ? (
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {headline}
              </h1>
            ) : null}
            {subheadline ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground sm:text-base">
                {subheadline}
              </p>
            ) : null}
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- merchant upload path
              <img
                src={imageUrl}
                alt=""
                className="mx-auto mt-6 max-h-80 w-full rounded-[var(--radius-lg)] object-cover"
              />
            ) : null}
            {ctaText ? (
              <a
                href="#order"
                className="mt-6 inline-block rounded-[var(--radius)] bg-primary px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)]"
              >
                {ctaText}
              </a>
            ) : null}
          </div>
        </section>
      );
    }

    case 'text': {
      const { content, align } = props as unknown as { content: string; align: string };
      return (
        <section className="px-4 py-6">
          <div
            className={cn(
              'mx-auto max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-foreground',
              align === 'center' && 'text-center',
              align === 'end' && 'text-end',
            )}
          >
            {content}
          </div>
        </section>
      );
    }

    case 'image': {
      const { url, alt } = props as unknown as { url: string | null; alt: string };
      if (!url) return null;
      return (
        <section className="px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- merchant upload path */}
          <img
            src={url}
            alt={alt}
            loading="lazy"
            className="mx-auto max-w-3xl rounded-[var(--radius-lg)]"
          />
        </section>
      );
    }

    case 'features': {
      const { title, items } = props as unknown as {
        title: string;
        items: Array<{ title: string; description: string }>;
      };
      if (items.length === 0) return null;

      return (
        <section className="px-4 py-8">
          <div className="mx-auto max-w-3xl">
            {title ? (
              <h2 className="mb-5 text-center text-lg font-semibold text-foreground">{title}</h2>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-border bg-surface-2 p-3.5"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-primary">
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-foreground">
                      {item.title}
                    </span>
                    {item.description ? (
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    case 'product': {
      const { productId, showPrice } = props as unknown as {
        productId: string | null;
        showPrice: boolean;
      };
      const product = productId ? context.products[productId] : null;
      if (!product) return null;

      return (
        <section className="px-4 py-6">
          <div className="mx-auto flex max-w-2xl items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface-1 p-4">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- merchant upload path
              <img
                src={product.imageUrl}
                alt=""
                className="size-24 shrink-0 rounded-[var(--radius)] object-cover"
              />
            ) : (
              <span className="flex size-24 shrink-0 items-center justify-center rounded-[var(--radius)] bg-surface-3 text-subtle-foreground">
                <Package className="size-6" aria-hidden />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{product.name}</p>
              {showPrice ? (
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  {formatMoney(product.price, context.currency, context.locale)}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      );
    }

    case 'productGrid': {
      const entries = Object.values(context.products).slice(
        0,
        (props as unknown as { limit: number }).limit,
      );
      if (entries.length === 0) return null;

      return (
        <section className="px-4 py-8">
          <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
            {entries.map((product) => (
              <li
                key={product.id}
                className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-1"
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- merchant upload path
                  <img src={product.imageUrl} alt="" className="aspect-square w-full object-cover" />
                ) : null}
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs text-foreground">{product.name}</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums text-foreground">
                    {formatMoney(product.price, context.currency, context.locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      );
    }

    case 'trust':
      return (
        <section className="px-4 py-6">
          <div className="mx-auto max-w-3xl">
            <TrustBadgeRow badges={context.badges} />
          </div>
        </section>
      );

    case 'testimonials': {
      const { title, items } = props as unknown as {
        title: string;
        items: Array<{ name: string; quote: string }>;
      };
      if (items.length === 0) return null;

      return (
        <section className="px-4 py-8">
          <div className="mx-auto max-w-3xl">
            {title ? (
              <h2 className="mb-5 text-center text-lg font-semibold text-foreground">{title}</h2>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item, index) => (
                <li
                  key={index}
                  className="rounded-[var(--radius-lg)] border border-border bg-surface-2 p-4"
                >
                  <p className="text-[13px] leading-relaxed text-foreground">{item.quote}</p>
                  <p className="mt-2 text-xs text-subtle-foreground">— {item.name}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    case 'offer': {
      const { title, description } = props as unknown as { title: string; description: string };
      return (
        <section className="px-4 py-6">
          <div className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border-2 border-primary bg-[var(--primary-soft)] p-5 text-center">
            {title ? <p className="text-base font-bold text-primary">{title}</p> : null}
            {description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{description}</p>
            ) : null}
          </div>
        </section>
      );
    }

    case 'countdown': {
      const { title, endsAt } = props as unknown as { title: string; endsAt: string | null };
      return (
        <section className="px-4 py-6">
          <div className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-border bg-surface-2 p-4 text-center">
            {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
            {/* Display only. A countdown never gates a price — that is decided
                server-side by the campaign window. */}
            <p className="mt-2 font-mono text-lg tabular-nums text-primary" dir="ltr">
              {endsAt ? new Date(endsAt).toLocaleDateString(context.locale) : '—'}
            </p>
          </div>
        </section>
      );
    }

    case 'faq': {
      const { title, items } = props as unknown as {
        title: string;
        items: Array<{ question: string; answer: string }>;
      };
      if (items.length === 0) return null;

      return (
        <section className="px-4 py-8">
          <div className="mx-auto max-w-2xl">
            {title ? (
              <h2 className="mb-4 text-center text-lg font-semibold text-foreground">{title}</h2>
            ) : null}
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li
                  key={index}
                  className="rounded-[var(--radius-lg)] border border-border bg-surface-1"
                >
                  <details className="group">
                    <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-foreground">
                      {item.question}
                    </summary>
                    <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                      {item.answer}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    case 'cta': {
      const { headline, text } = props as unknown as { headline: string; text: string };
      return (
        <section className="px-4 py-8 text-center">
          {headline ? (
            <p className="text-lg font-semibold text-foreground">{headline}</p>
          ) : null}
          {text ? (
            <a
              href="#order"
              className="mt-4 inline-block rounded-[var(--radius)] bg-primary px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)]"
            >
              {text}
            </a>
          ) : null}
        </section>
      );
    }

    case 'orderForm': {
      const { title } = props as unknown as { title: string };
      return (
        <section id="order" className="px-4 py-8">
          <div className="mx-auto max-w-lg">
            {title ? (
              <h2 className="mb-4 text-center text-lg font-semibold text-foreground">{title}</h2>
            ) : null}
            {context.orderFormSlot ?? (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border p-6 text-center text-xs text-subtle-foreground">
                —
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'video': {
      const { provider, videoId } = props as unknown as { provider: string; videoId: string };
      // Only an alphanumeric id is accepted, and the src is built here — a
      // merchant can never supply a raw iframe or an arbitrary URL.
      const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      if (!safeId) return null;

      const src =
        provider === 'vimeo'
          ? `https://player.vimeo.com/video/${safeId}`
          : `https://www.youtube-nocookie.com/embed/${safeId}`;

      return (
        <section className="px-4 py-6">
          <div className="mx-auto aspect-video max-w-2xl overflow-hidden rounded-[var(--radius-lg)]">
            <iframe
              src={src}
              title="video"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              className="size-full border-0"
            />
          </div>
        </section>
      );
    }

    case 'spacer': {
      const { size } = props as unknown as { size: string };
      return <div className={size === 'lg' ? 'h-16' : size === 'sm' ? 'h-4' : 'h-8'} aria-hidden />;
    }

    default:
      return null;
  }
}
