import 'server-only';

import { prisma } from '@/db/client';
import { resolveShippingPrice } from '@/features/shipping/rules';
import { AppError, type FieldErrors } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { normalisePhone } from '@/lib/phone';
import { enforceRateLimit } from '@/lib/rate-limit';
import { clientIp } from './audit-service';
import { countRecentOrders } from './customer-service';
import { createOrder, resolveOrderLines } from './order-service';
import { getCheckoutFields, isIpBlocked, listCustomFields } from './store-service';

/**
 * Checkout.
 *
 * The one place where an untrusted visitor creates a row in a merchant's
 * database, so every guard lives here:
 *
 *  - IP blocklist, checked server-side before anything else.
 *  - Rate limiting per IP.
 *  - Required-field validation driven by the merchant's checkout configuration,
 *    not by whatever the browser decided to send.
 *  - Duplicate-order protection with the merchant's chosen action.
 *  - Prices and shipping resolved from the database; the cart only says *what*
 *    and *how many*, never *for how much*.
 */

export interface CheckoutInput {
  storeSlug: string;
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  state: string;
  city: string;
  address: string;
  notes?: string | null;
  shippingMethodId?: string | null;
  customFields?: Record<string, string>;
  sessionId?: string | null;
  landingPageId?: string | null;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  total: number;
  flagged: boolean;
}

export async function submitCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const store = await prisma.store.findFirst({
    where: { slug: input.storeSlug, status: 'ACTIVE' },
    include: { settings: true },
  });
  if (!store) throw new AppError('NOT_FOUND', 'Store not found.');

  const ip = clientIp();

  // Blocklist first: a blocked address should not be able to consume rate
  // limit budget or trigger any downstream work.
  if (await isIpBlocked(store.id, ip)) {
    throw new AppError('IP_BLOCKED', 'This request was blocked.');
  }

  enforceRateLimit('orderCreate', ip ?? input.customerPhone);

  if (input.items.length === 0) {
    throw new AppError('CART_EMPTY', 'No items in the order.');
  }

  const phone = normalisePhone(input.customerPhone, store.country);
  const fieldErrors = await validateRequiredFields(store.id, input, phone.valid);

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError('CHECKOUT_FIELD_REQUIRED', 'Missing required fields.', { fieldErrors });
  }

  // Duplicate-order protection.
  let flagged = false;
  let riskReason: string | null = null;

  const settings = store.settings;
  if (settings?.fraudProtectionEnabled) {
    const recent = await countRecentOrders(store.id, phone.canonical, settings.fraudWindowHours);

    if (recent >= settings.fraudMaxOrders) {
      riskReason = `${recent} orders in ${settings.fraudWindowHours}h`;

      if (settings.fraudAction === 'BLOCK') {
        throw new AppError('ORDER_DUPLICATE_BLOCKED', 'Too many repeated orders.', {
          meta: { recent, window: settings.fraudWindowHours },
        });
      }
      // FLAG and ALLOW both create the order; FLAG marks it for review, which is
      // usually better than silently rejecting a genuine repeat customer.
      flagged = settings.fraudAction === 'FLAG';
    }
  }

  const lines = await resolveOrderLines(prisma, store.id, input.items, {
    allowPriceOverride: false,
  });

  const shippingAmount = await resolveShipping(store.id, input.shippingMethodId ?? null, {
    state: input.state,
    city: input.city,
  });

  const order = await createOrder(
    store.id,
    {
      source: input.landingPageId ? 'LANDING_PAGE' : 'STOREFRONT',
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      state: input.state,
      city: input.city,
      address: input.address,
      notes: input.notes ?? null,
      lines,
      shippingAmount,
      discountAmount: 0,
      shippingMethodId: input.shippingMethodId ?? null,
      landingPageId: input.landingPageId ?? null,
      ipAddress: ip,
      riskFlagged: flagged,
      riskReason,
      customFields: input.customFields ?? null,
      actor: { type: 'CUSTOMER', name: input.customerName },
    },
    store.currency,
    store.country,
  );

  // Close out the abandoned-checkout record, if tracking is on.
  if (input.sessionId) {
    await markRecovered(store.id, input.sessionId, order.id);
  }

  if (input.landingPageId) {
    await prisma.landingPage
      .updateMany({
        where: { id: input.landingPageId, storeId: store.id },
        data: { conversions: { increment: 1 } },
      })
      .catch((error: unknown) => {
        logger.warn('failed to increment page conversions', { error: String(error) });
      });
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    flagged,
  };
}

/**
 * Validate against the merchant's checkout field configuration.
 *
 * Which fields are required is store data, so this has to be checked on the
 * server — a browser could submit anything regardless of what the form rendered.
 */
async function validateRequiredFields(
  storeId: string,
  input: CheckoutInput,
  phoneValid: boolean,
): Promise<FieldErrors> {
  const errors: FieldErrors = {};
  const fields = await getCheckoutFields(storeId);

  const valueFor = (key: string): string => {
    switch (key) {
      case 'customerName':
        return input.customerName;
      case 'phone':
        return input.customerPhone;
      case 'email':
        return input.customerEmail ?? '';
      case 'state':
        return input.state;
      case 'city':
        return input.city;
      case 'address':
        return input.address;
      case 'notes':
        return input.notes ?? '';
      default:
        return '';
    }
  };

  for (const field of fields) {
    if (field.mode !== 'REQUIRED') continue;
    if (!valueFor(field.fieldKey).trim()) {
      errors[field.fieldKey] = ['validation.required'];
    }
  }

  // Phone is always required and must be well-formed: with cash on delivery an
  // unreachable customer is an undeliverable order.
  if (!input.customerPhone.trim()) {
    errors.phone = ['validation.required'];
  } else if (!phoneValid) {
    errors.phone = ['validation.invalidPhone'];
  }

  const customFields = await listCustomFields(storeId, true);
  for (const field of customFields) {
    if (!field.required) continue;
    if (!input.customFields?.[field.fieldKey]?.trim()) {
      errors[`custom.${field.fieldKey}`] = ['validation.required'];
    }
  }

  return errors;
}

async function resolveShipping(
  storeId: string,
  methodId: string | null,
  destination: { state: string; city: string },
): Promise<number> {
  const method = methodId
    ? await prisma.shippingMethod.findFirst({
        where: { id: methodId, storeId, isActive: true, archivedAt: null },
        include: { zones: { orderBy: { position: 'asc' } } },
      })
    : await prisma.shippingMethod.findFirst({
        where: { storeId, isActive: true, archivedAt: null },
        orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
        include: { zones: { orderBy: { position: 'asc' } } },
      });

  // A store with no delivery method still takes orders, at zero shipping —
  // better than refusing the sale over a configuration gap.
  if (!method) return 0;
  if (method.type === 'PICKUP') return 0;

  return resolveShippingPrice(
    { id: method.id, price: method.price, zones: method.zones },
    destination,
  ).price;
}

// ---------------------------------------------------------------------------
// Abandoned checkout tracking
// ---------------------------------------------------------------------------

export interface AbandonedSnapshot {
  storeSlug: string;
  sessionId: string;
  step: 'started' | 'contact' | 'address' | 'review';
  cart: Array<{ productId: string; variantId?: string | null; quantity: number; name: string }>;
  value: number;
  customerName?: string | null;
  customerPhone?: string | null;
  state?: string | null;
  city?: string | null;
}

/**
 * Record an in-progress checkout.
 *
 * Only runs when the merchant enabled the app, and only stores what the
 * customer typed themselves — no fingerprinting, no inferred identity.
 */
export async function trackAbandoned(snapshot: AbandonedSnapshot): Promise<void> {
  const store = await prisma.store.findFirst({
    where: { slug: snapshot.storeSlug, status: 'ACTIVE' },
    select: { id: true, settings: { select: { abandonedTrackingEnabled: true } } },
  });

  if (!store?.settings?.abandonedTrackingEnabled) return;

  const installation = await prisma.appInstallation.findUnique({
    where: { storeId_appKey: { storeId: store.id, appKey: 'abandoned_orders' } },
    select: { isEnabled: true },
  });
  if (!installation?.isEnabled) return;

  const phone = snapshot.customerPhone
    ? normalisePhone(snapshot.customerPhone).canonical
    : null;

  await prisma.abandonedCheckout.upsert({
    where: { storeId_sessionId: { storeId: store.id, sessionId: snapshot.sessionId } },
    create: {
      storeId: store.id,
      sessionId: snapshot.sessionId,
      cart: snapshot.cart as unknown as object,
      value: snapshot.value,
      checkoutStep: snapshot.step,
      customerName: snapshot.customerName ?? null,
      customerPhone: phone,
      state: snapshot.state ?? null,
      city: snapshot.city ?? null,
    },
    update: {
      cart: snapshot.cart as unknown as object,
      value: snapshot.value,
      checkoutStep: snapshot.step,
      customerName: snapshot.customerName ?? undefined,
      customerPhone: phone ?? undefined,
      state: snapshot.state ?? undefined,
      city: snapshot.city ?? undefined,
    },
  });
}

async function markRecovered(storeId: string, sessionId: string, orderId: string): Promise<void> {
  try {
    await prisma.abandonedCheckout.updateMany({
      where: { storeId, sessionId, status: 'OPEN' },
      data: { status: 'RECOVERED', convertedOrderId: orderId },
    });
  } catch (error) {
    logger.warn('failed to mark abandoned checkout recovered', {
      storeId,
      error: String(error),
    });
  }
}
