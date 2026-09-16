import type { BadgeTone } from '@/components/ui/badge';

/**
 * Order state machine.
 *
 * REBUILD PROPOSAL — the reference recordings show status chips and a status
 * filter row, but not the full transition matrix. These states and edges are
 * our proposal, chosen to model a COD operation end to end. They are data, not
 * control flow: a merchant-configurable machine can later replace this table
 * without touching call sites.
 *
 * Nothing mutates `Order.status` directly. Every change goes through
 * OrderService.changeStatus, which consults this table, writes an
 * OrderStatusHistory row and an audit entry, and applies the side effects
 * (inventory restock, timestamps, shipping status) in one transaction.
 */

export const ORDER_STATUSES = [
  'NEW',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_SHIPPING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'DELIVERY_FAILED',
  'RETURNED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed target states for each state. An empty array is a terminal state. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'READY_FOR_SHIPPING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['READY_FOR_SHIPPING', 'SHIPPED', 'CANCELLED'],
  READY_FOR_SHIPPING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERED: ['RETURNED'],
  DELIVERY_FAILED: ['SHIPPED', 'RETURNED', 'CANCELLED'],
  RETURNED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ORDER_TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

export function isTerminal(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/** Statuses that no longer consume stock — reaching one restocks the items. */
export const RESTOCKING_STATUSES: readonly OrderStatus[] = ['CANCELLED', 'RETURNED'];

/**
 * Statuses that count in the delivery-rate denominator: orders that actually
 * reached the shipping stage. Documented so the metric has one definition.
 */
export const SHIPPING_ELIGIBLE_STATUSES: readonly OrderStatus[] = [
  'SHIPPED',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RETURNED',
];

/** Statuses excluded from revenue totals. */
export const NON_REVENUE_STATUSES: readonly OrderStatus[] = ['CANCELLED'];

export const OPEN_STATUSES: readonly OrderStatus[] = [
  'NEW',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_SHIPPING',
  'SHIPPED',
];

export type ShippingStatus =
  | 'NOT_SHIPPED'
  | 'READY'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

/** The shipping sub-status implied by an order status. */
export function shippingStatusFor(status: OrderStatus): ShippingStatus {
  switch (status) {
    case 'READY_FOR_SHIPPING':
      return 'READY';
    case 'SHIPPED':
      return 'IN_TRANSIT';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'DELIVERY_FAILED':
      return 'FAILED';
    case 'RETURNED':
      return 'RETURNED';
    default:
      return 'NOT_SHIPPED';
  }
}

/** The column on Order that records when this status was first reached. */
export function timestampFieldFor(status: OrderStatus): string | null {
  switch (status) {
    case 'CONFIRMED':
      return 'confirmedAt';
    case 'SHIPPED':
      return 'shippedAt';
    case 'DELIVERED':
      return 'deliveredAt';
    case 'CANCELLED':
      return 'cancelledAt';
    case 'RETURNED':
      return 'returnedAt';
    default:
      return null;
  }
}

export function statusTone(status: OrderStatus): BadgeTone {
  switch (status) {
    case 'NEW':
      return 'info';
    case 'CONFIRMED':
      return 'primary';
    case 'PROCESSING':
    case 'READY_FOR_SHIPPING':
      return 'warning';
    case 'SHIPPED':
      return 'accent';
    case 'DELIVERED':
      return 'success';
    case 'CANCELLED':
    case 'DELIVERY_FAILED':
      return 'danger';
    case 'RETURNED':
      return 'neutral';
  }
}

/** Transitions a merchant should be asked to confirm before they happen. */
export function isDestructive(to: OrderStatus): boolean {
  return to === 'CANCELLED' || to === 'RETURNED';
}

/** Transitions that should capture a reason from the operator. */
export function requiresReason(to: OrderStatus): boolean {
  return to === 'CANCELLED' || to === 'DELIVERY_FAILED' || to === 'RETURNED';
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}
