'use server';

import { z } from 'zod';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { normalisePhone } from '@/lib/phone';
import { enforceRateLimit } from '@/lib/rate-limit';
import { emit } from '@/server/events';
import { clientIp } from '@/server/services/audit-service';
import { submitCheckout, trackAbandoned, type CheckoutResult } from '@/server/services/checkout-service';
import { quoteShipping, type ShippingQuote } from '@/server/services/shipping-service';
import { getStorefront, trackOrder } from '@/server/services/storefront-service';

import { zodFieldErrors } from './helpers';

/**
 * Storefront actions.
 *
 * Public and unauthenticated. Every one re-derives the store from its slug and
 * never trusts an id, a price or a total from the request.
 */

const checkoutSchema = z.object({
  storeSlug: z.string().min(1).max(60),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().nullable().optional(),
        quantity: z.coerce.number().int().min(1).max(99),
      }),
    )
    .min(1, 'errors.CART_EMPTY')
    .max(30),
  customerName: z.string().trim().max(120).default(''),
  customerPhone: z.string().trim().max(30).default(''),
  customerEmail: z.string().trim().max(200).optional().or(z.literal('')),
  state: z.string().trim().max(80).default(''),
  city: z.string().trim().max(80).default(''),
  address: z.string().trim().max(300).default(''),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  shippingMethodId: z.string().nullable().optional(),
  customFields: z.record(z.string().max(500)).optional(),
  sessionId: z.string().max(64).nullable().optional(),
  landingPageId: z.string().nullable().optional(),
});

export async function submitCheckoutAction(
  input: unknown,
): Promise<ActionResult<CheckoutResult>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid checkout.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const result = await submitCheckout({
      ...parsed.data,
      customerEmail: parsed.data.customerEmail || null,
      notes: parsed.data.notes || null,
    });
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function quoteShippingAction(
  storeSlug: string,
  destination: { state: string; city: string },
): Promise<ActionResult<ShippingQuote[]>> {
  try {
    const store = await getStorefront(storeSlug);
    if (!store) return fail('NOT_FOUND', 'Store not found.');
    return ok(await quoteShipping(store.id, destination));
  } catch (error) {
    return toActionResult(error);
  }
}

const trackSchema = z.object({
  storeSlug: z.string().min(1).max(60),
  orderNumber: z.string().trim().max(20).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
});

export async function trackOrderAction(input: unknown) {
  const parsed = trackSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid input.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    // Rate limited so the tracking form cannot be used to probe order numbers.
    enforceRateLimit('orderTracking', clientIp() ?? parsed.data.storeSlug);

    const store = await getStorefront(parsed.data.storeSlug);
    if (!store) return fail('NOT_FOUND', 'Store not found.');
    if (!store.settings.trackingEnabled) return fail('NOT_FOUND', 'Tracking disabled.');

    const canonical = parsed.data.phone
      ? normalisePhone(parsed.data.phone, store.country).canonical
      : '';

    const order = await trackOrder(
      store.id,
      store.settings.trackingMethod,
      { orderNumber: parsed.data.orderNumber || undefined, phone: parsed.data.phone || undefined },
      canonical,
    );

    // A miss returns NOT_FOUND with no detail — never "that order exists but
    // the phone is wrong", which would confirm the order number.
    if (!order) return fail('NOT_FOUND', 'Order not found.');

    return ok({
      orderNumber: order.orderNumber,
      status: order.status,
      shippingStatus: order.shippingStatus,
      total: order.total,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      city: order.city,
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        variant: item.variantSnapshot,
        quantity: item.quantity,
      })),
      timeline: order.history.map((entry) => ({
        status: entry.toStatus,
        at: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return toActionResult(error);
  }
}

const abandonedSchema = z.object({
  storeSlug: z.string().min(1).max(60),
  sessionId: z.string().min(8).max(64),
  step: z.enum(['started', 'contact', 'address', 'review']),
  cart: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().nullable().optional(),
        quantity: z.coerce.number().int().min(1).max(99),
        name: z.string().max(200),
      }),
    )
    .max(30),
  value: z.coerce.number().int().min(0),
  customerName: z.string().trim().max(120).nullable().optional(),
  customerPhone: z.string().trim().max(30).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
});

export async function trackAbandonedAction(input: unknown): Promise<ActionResult> {
  const parsed = abandonedSchema.safeParse(input);
  // Tracking is best-effort telemetry: a malformed payload is dropped quietly
  // rather than surfacing an error to a customer mid-checkout.
  if (!parsed.success) return ok();

  try {
    await trackAbandoned(parsed.data);
    return ok();
  } catch {
    return ok();
  }
}

const eventSchema = z.object({
  storeSlug: z.string().min(1).max(60),
  name: z.enum(['product_viewed', 'add_to_cart', 'checkout_started', 'page_viewed']),
  productId: z.string().nullable().optional(),
  sessionId: z.string().max(64).nullable().optional(),
  value: z.coerce.number().int().nullable().optional(),
  path: z.string().max(300).nullable().optional(),
});

/**
 * Storefront analytics events.
 *
 * Fire-and-forget: a failure here must never be visible to a shopper, and never
 * blocks a page view or an add-to-cart.
 */
export async function trackEventAction(input: unknown): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return ok();

  try {
    const store = await getStorefront(parsed.data.storeSlug);
    if (!store) return ok();

    await emit({
      name: parsed.data.name,
      storeId: store.id,
      productId: parsed.data.productId ?? null,
      sessionId: parsed.data.sessionId ?? null,
      value: parsed.data.value ?? null,
      path: parsed.data.path ?? null,
    });
    return ok();
  } catch {
    return ok();
  }
}
