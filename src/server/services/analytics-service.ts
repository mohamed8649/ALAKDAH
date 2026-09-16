import 'server-only';

import { prisma } from '@/db/client';
import {
  NON_REVENUE_STATUSES,
  SHIPPING_ELIGIBLE_STATUSES,
  type OrderStatus,
} from '@/features/orders/state-machine';
import { dayKey, daysBetween, enumerateDays, type ResolvedRange } from '@/lib/datetime';
import { assertPermission, type StoreContext } from '@/server/policies/context';

/**
 * Analytics.
 *
 * Every metric below has one definition, written next to it, and that same
 * definition is shown to the merchant in the UI tooltip. A metric that cannot
 * be computed from the available data returns null — never a fabricated zero.
 *
 * Reports read directly from the order tables. At the volumes a single store
 * produces this is correct and fast; `Order` carries the composite indexes
 * these queries need. The shape here (a range in, a snapshot out) is what lets
 * a daily-rollup table slot in later without changing a single call site.
 */

export interface OrderMetrics {
  totalOrders: number;
  totalSales: number;
  deliveredOrders: number;
  shippedEligible: number;
  cancelledOrders: number;
  returnedOrders: number;
  newCustomers: number;
  /** Delivered ÷ orders that reached the shipping stage. Null when none did. */
  deliveryRate: number | null;
  /** Returned ÷ delivered. Null when nothing has been delivered. */
  returnRate: number | null;
  cancellationRate: number | null;
  averageOrderValue: number | null;
  averageDaily: number;
  statusCounts: Record<OrderStatus, number>;
  hasData: boolean;
}

export async function getOrderMetrics(
  context: StoreContext,
  range: ResolvedRange,
): Promise<OrderMetrics> {
  assertPermission(context, 'analytics.view');

  const [grouped, revenue, newCustomers] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where: {
        storeId: context.storeId,
        createdAt: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: {
        storeId: context.storeId,
        createdAt: { gte: range.from, lte: range.to },
        status: { notIn: [...NON_REVENUE_STATUSES] },
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.customer.count({
      where: { storeId: context.storeId, createdAt: { gte: range.from, lte: range.to } },
    }),
  ]);

  const statusCounts = emptyStatusCounts();
  for (const row of grouped) {
    statusCounts[row.status as OrderStatus] = row._count._all;
  }

  const totalOrders = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const deliveredOrders = statusCounts.DELIVERED;
  const shippedEligible = SHIPPING_ELIGIBLE_STATUSES.reduce(
    (sum, status) => sum + statusCounts[status],
    0,
  );
  const revenueOrders = revenue._count;
  const totalSales = revenue._sum.total ?? 0;
  const days = daysBetween(range.fromKey, range.toKey);

  return {
    totalOrders,
    totalSales,
    deliveredOrders,
    shippedEligible,
    cancelledOrders: statusCounts.CANCELLED,
    returnedOrders: statusCounts.RETURNED,
    newCustomers,
    deliveryRate: shippedEligible > 0 ? (deliveredOrders / shippedEligible) * 100 : null,
    returnRate: deliveredOrders > 0 ? (statusCounts.RETURNED / deliveredOrders) * 100 : null,
    cancellationRate: totalOrders > 0 ? (statusCounts.CANCELLED / totalOrders) * 100 : null,
    averageOrderValue: revenueOrders > 0 ? Math.round(totalSales / revenueOrders) : null,
    averageDaily: totalOrders / days,
    statusCounts,
    hasData: totalOrders > 0,
  };
}

export interface TimeSeriesPoint {
  key: string;
  orders: number;
  sales: number;
}

/**
 * Orders and sales per day.
 *
 * Grouping happens in the store's timezone, not UTC: a merchant in Tripoli
 * expects "yesterday" to mean their yesterday. Days with no orders are filled
 * with zeros so the chart shows a gap as a gap rather than skipping it.
 */
export async function getOrdersOverTime(
  context: StoreContext,
  range: ResolvedRange,
): Promise<TimeSeriesPoint[]> {
  assertPermission(context, 'analytics.view');

  const orders = await prisma.order.findMany({
    where: {
      storeId: context.storeId,
      createdAt: { gte: range.from, lte: range.to },
    },
    select: { createdAt: true, total: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  const buckets = new Map<string, { orders: number; sales: number }>();
  for (const key of enumerateDays(range.fromKey, range.toKey)) {
    buckets.set(key, { orders: 0, sales: 0 });
  }

  for (const order of orders) {
    const key = dayKey(order.createdAt, context.timezone);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (!NON_REVENUE_STATUSES.includes(order.status as OrderStatus)) {
      bucket.sales += order.total;
    }
  }

  return [...buckets.entries()].map(([key, value]) => ({ key, ...value }));
}

export interface TopProduct {
  productId: string | null;
  name: string;
  unitsSold: number;
  revenue: number;
  orders: number;
}

export async function getTopProducts(
  context: StoreContext,
  range: ResolvedRange,
  limit = 8,
): Promise<TopProduct[]> {
  assertPermission(context, 'analytics.view');

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        storeId: context.storeId,
        createdAt: { gte: range.from, lte: range.to },
        status: { notIn: [...NON_REVENUE_STATUSES] },
      },
    },
    select: { productId: true, nameSnapshot: true, quantity: true, total: true, orderId: true },
  });

  const byProduct = new Map<string, TopProduct & { orderIds: Set<string> }>();

  for (const item of items) {
    // Items whose product was deleted still count, grouped by their snapshot
    // name — dropping them would understate historical sales.
    const key = item.productId ?? `deleted:${item.nameSnapshot}`;
    const entry = byProduct.get(key) ?? {
      productId: item.productId,
      name: item.nameSnapshot,
      unitsSold: 0,
      revenue: 0,
      orders: 0,
      orderIds: new Set<string>(),
    };

    entry.unitsSold += item.quantity;
    entry.revenue += item.total;
    entry.orderIds.add(item.orderId);
    byProduct.set(key, entry);
  }

  return [...byProduct.values()]
    .map(({ orderIds, ...rest }) => ({ ...rest, orders: orderIds.size }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export interface RegionCount {
  region: string;
  orders: number;
  sales: number;
}

export async function getOrdersByRegion(
  context: StoreContext,
  range: ResolvedRange,
  limit = 8,
): Promise<RegionCount[]> {
  assertPermission(context, 'analytics.view');

  const grouped = await prisma.order.groupBy({
    by: ['state'],
    where: {
      storeId: context.storeId,
      createdAt: { gte: range.from, lte: range.to },
      status: { notIn: [...NON_REVENUE_STATUSES] },
    },
    _count: { _all: true },
    _sum: { total: true },
  });

  return grouped
    .map((row) => ({
      region: row.state || '—',
      orders: row._count._all,
      sales: row._sum.total ?? 0,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, limit);
}

export interface ProductAnalyticsRow {
  productId: string;
  name: string;
  views: number;
  orders: number;
  unitsSold: number;
  revenue: number;
  /** Orders ÷ views. Null when there are too few views to be meaningful. */
  conversion: number | null;
}

/** Below this many views a conversion figure is noise, so it is not shown. */
export const MIN_VIEWS_FOR_CONVERSION = 30;

export async function getProductAnalytics(
  context: StoreContext,
  range: ResolvedRange,
  limit = 30,
): Promise<{ rows: ProductAnalyticsRow[]; totalViews: number; hasEnoughEvents: boolean }> {
  assertPermission(context, 'analytics.view');

  const [products, views, items] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: context.storeId, archivedAt: null },
      select: { id: true, name: true },
      take: 500,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['productId'],
      where: {
        storeId: context.storeId,
        name: 'product_viewed',
        createdAt: { gte: range.from, lte: range.to },
        productId: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          storeId: context.storeId,
          createdAt: { gte: range.from, lte: range.to },
          status: { notIn: [...NON_REVENUE_STATUSES] },
        },
        productId: { not: null },
      },
      select: { productId: true, quantity: true, total: true, orderId: true },
    }),
  ]);

  const viewsByProduct = new Map(views.map((row) => [row.productId!, row._count._all]));
  const salesByProduct = new Map<string, { units: number; revenue: number; orders: Set<string> }>();

  for (const item of items) {
    const entry = salesByProduct.get(item.productId!) ?? {
      units: 0,
      revenue: 0,
      orders: new Set<string>(),
    };
    entry.units += item.quantity;
    entry.revenue += item.total;
    entry.orders.add(item.orderId);
    salesByProduct.set(item.productId!, entry);
  }

  const totalViews = views.reduce((sum, row) => sum + row._count._all, 0);

  const rows = products
    .map((product) => {
      const productViews = viewsByProduct.get(product.id) ?? 0;
      const sales = salesByProduct.get(product.id);
      const orders = sales?.orders.size ?? 0;

      return {
        productId: product.id,
        name: product.name,
        views: productViews,
        orders,
        unitsSold: sales?.units ?? 0,
        revenue: sales?.revenue ?? 0,
        conversion:
          productViews >= MIN_VIEWS_FOR_CONVERSION ? (orders / productViews) * 100 : null,
      };
    })
    .filter((row) => row.views > 0 || row.orders > 0)
    .sort((a, b) => b.revenue - a.revenue || b.views - a.views)
    .slice(0, limit);

  return { rows, totalViews, hasEnoughEvents: totalViews >= MIN_VIEWS_FOR_CONVERSION };
}

export interface PageAnalyticsRow {
  pageId: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  conversions: number;
  conversionRate: number | null;
}

export async function getPageAnalytics(
  context: StoreContext,
): Promise<PageAnalyticsRow[]> {
  assertPermission(context, 'analytics.view');

  const pages = await prisma.landingPage.findMany({
    where: { storeId: context.storeId, archivedAt: null },
    select: { id: true, title: true, slug: true, status: true, views: true, conversions: true },
    orderBy: { views: 'desc' },
    take: 50,
  });

  return pages.map((page) => ({
    pageId: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    views: page.views,
    conversions: page.conversions,
    conversionRate:
      page.views >= MIN_VIEWS_FOR_CONVERSION ? (page.conversions / page.views) * 100 : null,
  }));
}

function emptyStatusCounts(): Record<OrderStatus, number> {
  return {
    NEW: 0,
    CONFIRMED: 0,
    PROCESSING: 0,
    READY_FOR_SHIPPING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
    DELIVERY_FAILED: 0,
    RETURNED: 0,
  };
}

/** Same window, immediately before the current one — used for trend arrows. */
export function previousRange(range: ResolvedRange): { from: Date; to: Date } {
  const span = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - span - 1),
    to: new Date(range.from.getTime() - 1),
  };
}

export async function getComparisonMetrics(
  context: StoreContext,
  range: ResolvedRange,
): Promise<{ totalOrders: number; totalSales: number }> {
  const previous = previousRange(range);

  const [count, revenue] = await Promise.all([
    prisma.order.count({
      where: { storeId: context.storeId, createdAt: { gte: previous.from, lte: previous.to } },
    }),
    prisma.order.aggregate({
      where: {
        storeId: context.storeId,
        createdAt: { gte: previous.from, lte: previous.to },
        status: { notIn: [...NON_REVENUE_STATUSES] },
      },
      _sum: { total: true },
    }),
  ]);

  return { totalOrders: count, totalSales: revenue._sum.total ?? 0 };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
