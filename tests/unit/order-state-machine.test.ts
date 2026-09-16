import { describe, expect, it } from 'vitest';

import {
  allowedTransitions,
  canTransition,
  isTerminal,
  NON_REVENUE_STATUSES,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  RESTOCKING_STATUSES,
  shippingStatusFor,
  timestampFieldFor,
  type OrderStatus,
} from '@/features/orders/state-machine';

/**
 * The order lifecycle is the spine of the product: stock, revenue, carrier
 * handover and the agent's work queue all key off it. These tests pin the
 * transitions themselves rather than any one caller, so a future edit to the
 * table has to be deliberate.
 */
describe('canTransition', () => {
  it('allows the ordinary COD path end to end', () => {
    expect(canTransition('NEW', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'READY_FOR_SHIPPING')).toBe(true);
    expect(canTransition('READY_FOR_SHIPPING', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('refuses to move backwards', () => {
    expect(canTransition('DELIVERED', 'SHIPPED')).toBe(false);
    expect(canTransition('SHIPPED', 'CONFIRMED')).toBe(false);
    expect(canTransition('CONFIRMED', 'NEW')).toBe(false);
  });

  it('treats a no-op as not a transition', () => {
    // This is what makes a repeated status change idempotent rather than an
    // error: the caller checks the guard, sees false, and stops.
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('will not cancel an order that already shipped', () => {
    // The goods are with the carrier; the honest outcomes are delivered,
    // failed, or returned.
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false);
  });

  it('lets a failed delivery be retried or written off', () => {
    expect(canTransition('DELIVERY_FAILED', 'SHIPPED')).toBe(true);
    expect(canTransition('DELIVERY_FAILED', 'RETURNED')).toBe(true);
    expect(canTransition('DELIVERY_FAILED', 'CANCELLED')).toBe(true);
  });
});

describe('the transition table itself', () => {
  it('covers every status', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('never names a status that does not exist', () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const target of targets) {
        expect(ORDER_STATUSES).toContain(target);
      }
    }
  });

  it('has exactly the two terminal states we expect', () => {
    const terminal = ORDER_STATUSES.filter(isTerminal);
    expect([...terminal].sort()).toEqual(['CANCELLED', 'RETURNED']);
  });

  it('can reach every status from NEW', () => {
    const seen = new Set<OrderStatus>(['NEW']);
    const queue: OrderStatus[] = ['NEW'];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of allowedTransitions(current)) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }

    // A status no order can ever reach is dead configuration.
    for (const status of ORDER_STATUSES) {
      expect(seen.has(status)).toBe(true);
    }
  });
});

describe('side-effect classification', () => {
  it('restocks exactly on cancellation and return', () => {
    expect([...RESTOCKING_STATUSES].sort()).toEqual(['CANCELLED', 'RETURNED']);
  });

  it('excludes cancelled orders from revenue', () => {
    expect(NON_REVENUE_STATUSES).toContain('CANCELLED');
  });

  it('derives the shipping status from the order status', () => {
    expect(shippingStatusFor('NEW')).toBe('NOT_SHIPPED');
    expect(shippingStatusFor('CONFIRMED')).toBe('NOT_SHIPPED');
    expect(shippingStatusFor('READY_FOR_SHIPPING')).toBe('READY');
    expect(shippingStatusFor('SHIPPED')).toBe('IN_TRANSIT');
    expect(shippingStatusFor('DELIVERED')).toBe('DELIVERED');
    expect(shippingStatusFor('DELIVERY_FAILED')).toBe('FAILED');
    expect(shippingStatusFor('RETURNED')).toBe('RETURNED');
  });

  it('stamps a timestamp only for statuses that have a column', () => {
    expect(timestampFieldFor('CONFIRMED')).toBe('confirmedAt');
    expect(timestampFieldFor('DELIVERED')).toBe('deliveredAt');
    expect(timestampFieldFor('PROCESSING')).toBeNull();
  });
});
