import 'server-only';

import { cache } from 'react';

import { prisma } from '@/db/client';
import { effectivePrice, type CampaignInput } from '@/features/campaigns/pricing';
import { stockState, type StockState } from '@/features/products/inventory';
import { AppError } from '@/lib/errors';
import { resolveThemeTokens, type ThemeTokens } from '@/server/catalog/themes';

/**
 * Storefront reads.
 *
 * Public, unauthenticated queries. Two rules hold throughout:
 *
 *  1. Only ACTIVE and VISIBLE products are ever returned. A draft or hidden
 *     product must not be reachable by guessing its slug.
 *  2. Prices are resolved here, on the server, against running campaigns. The
 *     browser is never told a base price it could have discounted itself.
 */

export interface StorefrontStore {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  country: string;
  locale: string;
  primaryColor: string;
  announcementEnabled: boolean;
  announcementText: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  whatsapp: string | null;
  themeKey: string;
  tokens: ThemeTokens;
  settings: {
    cartEnabled: boolean;
    thankYouEnabled: boolean;
    thankYouTitle: string;
    thankYouMessage: string;
    thankYouButtonText: string;
    thankYouButtonUrl: string | null;
    quickContactPhoneEnabled: boolean;
    quickContactPhone: string | null;
    quickContactWhatsappEnabled: boolean;
    quickContactWhatsapp: string | null;
    quickContactCountryCode: string;
    trackingEnabled: boolean;
    trackingMethod: string;
  };
}

/**
 * Resolve a store by slug. Deduplicated per request so a page and its layout
 * do not both query for the same store.
 */
export const getStorefront = cache(async (slug: string): Promise<StorefrontStore | null> => {
  const store = await prisma.store.findFirst({
    where: { slug, status: 'ACTIVE' },
    include: { settings: true, themeConfig: true },
  });

  if (!store) return null;

  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description,
    logoUrl: store.logoUrl,
    faviconUrl: store.faviconUrl,
    phone: store.phone,
    currency: store.currency,
    timezone: store.timezone,
    country: store.country,
    locale: store.defaultLocale,
    primaryColor: store.primaryColor,
    announcementEnabled: store.announcementEnabled,
    announcementText: store.announcementText,
    instagram: store.instagram,
    facebook: store.facebook,
    tiktok: store.tiktok,
    whatsapp: store.whatsapp,
    themeKey: store.themeConfig?.themeKey ?? 'aswaq',
    tokens: {
      ...resolveThemeTokens(
        store.themeConfig?.themeKey ?? 'aswaq',
        (store.themeConfig?.tokenOverrides as Partial<ThemeTokens> | null) ?? null,
      ),
      // The merchant's brand colour from the Design page always wins over the
      // theme's default accent.
      primary: store.primaryColor,
    },
    settings: {
      cartEnabled: store.settings?.cartEnabled ?? true,
      thankYouEnabled: store.settings?.thankYouEnabled ?? true,
      thankYouTitle: store.settings?.thankYouTitle ?? 'شكراً لطلبك!',
      thankYouMessage: store.settings?.thankYouMessage ?? '',
      thankYouButtonText: store.settings?.thankYouButtonText ?? '',
      thankYouButtonUrl: store.settings?.thankYouButtonUrl ?? null,
      quickContactPhoneEnabled: store.settings?.quickContactPhoneEnabled ?? false,
      quickContactPhone: store.settings?.quickContactPhone ?? null,
      quickContactWhatsappEnabled: store.settings?.quickContactWhatsappEnabled ?? false,
      quickContactWhatsapp: store.settings?.quickContactWhatsapp ?? null,
      quickContactCountryCode: store.settings?.quickContactCountryCode ?? '+218',
      trackingEnabled: store.settings?.trackingEnabled ?? true,
      trackingMethod: store.settings?.trackingMethod ?? 'ORDER_NUMBER_AND_PHONE',
    },
  };
});

export interface StorefrontProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  discountPercent: number;
  imageUrl: string | null;
  stockState: StockState;
  purchasable: boolean;
}

async function runningCampaigns(storeId: string, now: Date): Promise<CampaignInput[]> {
  const rows = await prisma.campaign.findMany({
    where: {
      storeId,
      isActive: true,
      archivedAt: null,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    include: { products: { select: { productId: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    discountPercent: row.discountPercent,
    startAt: row.startAt,
    endAt: row.endAt,
    isActive: row.isActive,
    appliesToAll: row.appliesToAll,
    productIds: row.products.map((link) => link.productId),
  }));
}

export async function listStorefrontProducts(
  storeId: string,
  options?: { search?: string; collectionHandle?: string; limit?: number; skip?: number },
): Promise<{ items: StorefrontProductCard[]; total: number }> {
  const now = new Date();
  const limit = options?.limit ?? 24;

  const where = {
    storeId,
    status: 'ACTIVE' as const,
    visibility: 'VISIBLE' as const,
    archivedAt: null,
    ...(options?.search
      ? { name: { contains: options.search, mode: 'insensitive' as const } }
      : {}),
    ...(options?.collectionHandle
      ? { collections: { some: { collection: { handle: options.collectionHandle } } } }
      : {}),
  };

  const [total, rows, campaigns] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options?.skip ?? 0,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        compareAtPrice: true,
        trackInventory: true,
        stockQuantity: true,
        lowStockThreshold: true,
        allowBackorder: true,
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      },
    }),
    runningCampaigns(storeId, now),
  ]);

  return {
    total,
    items: rows.map((row) => {
      const priced = effectivePrice(
        { id: row.id, price: row.price, compareAtPrice: row.compareAtPrice },
        campaigns,
        now,
      );
      const stock = {
        trackInventory: row.trackInventory,
        stockQuantity: row.stockQuantity,
        lowStockThreshold: row.lowStockThreshold,
        allowBackorder: row.allowBackorder,
      };

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: priced.price,
        compareAt: priced.compareAt,
        discountPercent: priced.discountPercent,
        imageUrl: row.images[0]?.url ?? null,
        stockState: stockState(stock),
        purchasable: row.allowBackorder || !row.trackInventory || row.stockQuantity > 0,
      };
    }),
  };
}

export interface StorefrontProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: number;
  compareAt: number | null;
  discountPercent: number;
  campaignName: string | null;
  images: Array<{ id: string; url: string; altText: string | null }>;
  options: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; value: string }>;
  }>;
  variants: Array<{
    id: string;
    title: string;
    price: number;
    compareAt: number | null;
    stockQuantity: number;
    purchasable: boolean;
    optionValueIds: string[];
  }>;
  offers: Array<{
    id: string;
    title: string;
    type: string;
    minQuantity: number;
    discountPercent: number | null;
  }>;
  related: StorefrontProductCard[];
  stockState: StockState;
  purchasable: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export async function getStorefrontProduct(
  storeId: string,
  slug: string,
): Promise<StorefrontProductDetail | null> {
  const now = new Date();

  const product = await prisma.product.findFirst({
    // Draft and hidden products are unreachable by slug, not merely unlisted.
    where: { storeId, slug, status: 'ACTIVE', visibility: 'VISIBLE', archivedAt: null },
    include: {
      images: { orderBy: { position: 'asc' } },
      options: { orderBy: { position: 'asc' }, include: { values: { orderBy: { position: 'asc' } } } },
      variants: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        include: { optionValues: true },
      },
      offers: { where: { isActive: true }, orderBy: { position: 'asc' } },
      relatedFrom: {
        orderBy: { position: 'asc' },
        include: {
          related: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              compareAtPrice: true,
              status: true,
              visibility: true,
              archivedAt: true,
              trackInventory: true,
              stockQuantity: true,
              lowStockThreshold: true,
              allowBackorder: true,
              images: { where: { isPrimary: true }, take: 1, select: { url: true } },
            },
          },
        },
      },
    },
  });

  if (!product) return null;

  const campaigns = await runningCampaigns(storeId, now);
  const priced = effectivePrice(
    { id: product.id, price: product.price, compareAtPrice: product.compareAtPrice },
    campaigns,
    now,
  );

  const stock = {
    trackInventory: product.trackInventory,
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    allowBackorder: product.allowBackorder,
  };

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    price: priced.price,
    compareAt: priced.compareAt,
    discountPercent: priced.discountPercent,
    campaignName: priced.campaignName,
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.altText,
    })),
    options: product.options.map((option) => ({
      id: option.id,
      name: option.name,
      values: option.values.map((value) => ({ id: value.id, value: value.value })),
    })),
    variants: product.variants.map((variant) => {
      const variantPriced = effectivePrice(
        {
          id: product.id,
          price: variant.price ?? product.price,
          compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice,
        },
        campaigns,
        now,
      );

      return {
        id: variant.id,
        title: variant.title,
        price: variantPriced.price,
        compareAt: variantPriced.compareAt,
        stockQuantity: variant.stockQuantity,
        purchasable:
          product.allowBackorder || !product.trackInventory || variant.stockQuantity > 0,
        optionValueIds: variant.optionValues.map((link) => link.optionValueId),
      };
    }),
    offers: product.offers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      type: offer.type,
      minQuantity: offer.minQuantity,
      discountPercent: offer.discountPercent,
    })),
    // Related products are re-filtered for visibility: a merchant may have
    // linked a product they later unpublished.
    related: product.relatedFrom
      .map((link) => link.related)
      .filter(
        (related) =>
          related.status === 'ACTIVE' && related.visibility === 'VISIBLE' && !related.archivedAt,
      )
      .map((related) => {
        const relatedPriced = effectivePrice(
          { id: related.id, price: related.price, compareAtPrice: related.compareAtPrice },
          campaigns,
          now,
        );
        return {
          id: related.id,
          name: related.name,
          slug: related.slug,
          price: relatedPriced.price,
          compareAt: relatedPriced.compareAt,
          discountPercent: relatedPriced.discountPercent,
          imageUrl: related.images[0]?.url ?? null,
          stockState: stockState({
            trackInventory: related.trackInventory,
            stockQuantity: related.stockQuantity,
            lowStockThreshold: related.lowStockThreshold,
            allowBackorder: related.allowBackorder,
          }),
          purchasable:
            related.allowBackorder || !related.trackInventory || related.stockQuantity > 0,
        };
      }),
    stockState: stockState(stock),
    purchasable: product.allowBackorder || !product.trackInventory || product.stockQuantity > 0,
    trackInventory: product.trackInventory,
    stockQuantity: product.stockQuantity,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  };
}

export async function listStorefrontCollections(storeId: string) {
  return prisma.collection.findMany({
    where: { storeId, isActive: true },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      handle: true,
      imageUrl: true,
      _count: { select: { products: true } },
    },
  });
}

/**
 * Public order lookup.
 *
 * REBUILD PROPOSAL — the default requires order number AND phone. Order numbers
 * are randomly generated (see generateOrderNumber), but requiring a second
 * factor means a leaked or guessed number alone still reveals nothing. The
 * merchant may relax this, and the looser modes are honoured, but the safe
 * combination is the default.
 */
export async function trackOrder(
  storeId: string,
  method: string,
  input: { orderNumber?: string; phone?: string },
  canonicalPhone: string,
) {
  const where: Record<string, unknown> = { storeId };

  if (method === 'ORDER_NUMBER_ONLY') {
    if (!input.orderNumber) throw new AppError('VALIDATION_FAILED', 'Order number required.');
    where.orderNumber = input.orderNumber.trim().toUpperCase();
  } else if (method === 'PHONE_ONLY') {
    if (!canonicalPhone) throw new AppError('VALIDATION_FAILED', 'Phone required.');
    where.customerPhone = canonicalPhone;
  } else {
    if (!input.orderNumber || !canonicalPhone) {
      throw new AppError('VALIDATION_FAILED', 'Order number and phone required.');
    }
    where.orderNumber = input.orderNumber.trim().toUpperCase();
    where.customerPhone = canonicalPhone;
  }

  const order = await prisma.order.findFirst({
    where: where as never,
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      status: true,
      shippingStatus: true,
      total: true,
      currency: true,
      createdAt: true,
      city: true,
      // Deliberately excluded from a public response: address, internal notes,
      // agent, carrier credentials, customer id, risk flags.
      items: { select: { nameSnapshot: true, variantSnapshot: true, quantity: true } },
      history: {
        orderBy: { createdAt: 'asc' },
        select: { toStatus: true, createdAt: true },
      },
    },
  });

  return order;
}
