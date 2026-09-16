import 'server-only';

import { prisma } from '@/db/client';
import { logger } from '@/lib/logger';

/**
 * In-process domain events.
 *
 * A commerce transaction is the priority. Analytics, pixels and notifications
 * are consequences of it, so they are dispatched *after* the transaction
 * commits and their failures are swallowed: a Facebook pixel that is down must
 * never stop an order from being created.
 *
 * This is deliberately not a distributed event bus. Handlers run in-process;
 * anything slow enqueues a BackgroundJob instead of blocking the request.
 */

export const ANALYTICS_EVENTS = [
  'product_viewed',
  'add_to_cart',
  'checkout_started',
  'order_created',
  'order_confirmed',
  'order_shipped',
  'order_delivered',
  'page_viewed',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export interface DomainEvent {
  name: AnalyticsEventName;
  storeId: string;
  sessionId?: string | null;
  productId?: string | null;
  orderId?: string | null;
  /** Monetary value in minor units, where the event has one. */
  value?: number | null;
  path?: string | null;
  payload?: Record<string, unknown>;
}

type Handler = (event: DomainEvent) => Promise<void> | void;

const handlers: Handler[] = [];

export function registerHandler(handler: Handler): void {
  handlers.push(handler);
}

/**
 * Dispatch an event. Never throws: every handler is isolated, and a failure is
 * logged rather than propagated to the caller's transaction.
 */
export async function emit(event: DomainEvent): Promise<void> {
  await Promise.all(
    handlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        logger.error('event handler failed', error, {
          storeId: event.storeId,
          entityType: 'event',
          entityId: event.name,
        });
      }
    }),
  );
}

/** Fire and forget — used where the caller must not wait on side effects. */
export function emitAsync(event: DomainEvent): void {
  void emit(event);
}

// ---------------------------------------------------------------------------
// Built-in handler: persist events for internal analytics
// ---------------------------------------------------------------------------

registerHandler(async (event) => {
  await prisma.analyticsEvent.create({
    data: {
      storeId: event.storeId,
      name: event.name,
      sessionId: event.sessionId ?? null,
      productId: event.productId ?? null,
      orderId: event.orderId ?? null,
      value: event.value ?? null,
      path: event.path ?? null,
      payload: event.payload ? (JSON.parse(JSON.stringify(event.payload)) as object) : undefined,
    },
  });
});
