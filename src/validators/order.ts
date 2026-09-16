import { z } from 'zod';

import { ORDER_STATUSES } from '@/features/orders/state-machine';
import { moneyField } from './product';

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, 'validation.required'),
  variantId: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(999),
  /** Optional override; when omitted the server uses the catalogue price. */
  unitPrice: moneyField({ optional: true }).optional(),
});

export const manualOrderSchema = z.object({
  customerName: z.string().trim().min(2, 'validation.required').max(120),
  customerPhone: z.string().trim().min(6, 'validation.invalidPhone').max(30),
  customerEmail: z.string().trim().email('validation.invalidEmail').max(200).nullable().optional().or(z.literal('')),
  state: z.string().trim().max(80).default(''),
  city: z.string().trim().max(80).default(''),
  address: z.string().trim().max(300).default(''),
  notes: z.string().trim().max(1000).nullable().optional(),
  internalNotes: z.string().trim().max(1000).nullable().optional(),
  shippingMethodId: z.string().nullable().optional(),
  shippingAmount: moneyField({ optional: true }).optional(),
  discountAmount: moneyField({ optional: true }).optional(),
  assignedAgentId: z.string().nullable().optional(),
  items: z.array(orderItemInputSchema).min(1, 'orders.manual.noItems').max(50),
  /** Client-generated key so a double submit creates one order, not two. */
  idempotencyKey: z.string().min(8).max(64).optional(),
});

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;

export const orderStatusChangeSchema = z.object({
  orderId: z.string().min(1),
  toStatus: z.enum(ORDER_STATUSES),
  reason: z.string().trim().max(500).nullable().optional(),
  /** Optimistic concurrency guard from the loaded record. */
  expectedVersion: z.coerce.number().int().min(1).optional(),
});

export type OrderStatusChangeInput = z.infer<typeof orderStatusChangeSchema>;

export const orderFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'REFUNDED', 'FAILED']).optional(),
  shippingStatus: z
    .enum(['NOT_SHIPPED', 'READY', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED'])
    .optional(),
  source: z
    .enum(['STOREFRONT', 'LANDING_PAGE', 'MANUAL', 'CALL_CENTER', 'IMPORT', 'API'])
    .optional(),
  productId: z.string().optional(),
  agentId: z.string().optional(),
  providerId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  flagged: z.enum(['1']).optional(),
  sort: z.enum(['newest', 'oldest', 'total_desc', 'total_asc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(25),
});

export type OrderFilter = z.infer<typeof orderFilterSchema>;

export const orderUpdateSchema = z.object({
  orderId: z.string().min(1),
  customerName: z.string().trim().min(2).max(120).optional(),
  customerPhone: z.string().trim().min(6).max(30).optional(),
  state: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(300).optional(),
  internalNotes: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  assignedAgentId: z.string().nullable().optional(),
  shippingProviderId: z.string().nullable().optional(),
  trackingNumber: z.string().trim().max(80).nullable().optional(),
  expectedVersion: z.coerce.number().int().min(1).optional(),
});

export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;

export const bulkOrderActionSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['change_status', 'assign_agent', 'assign_provider']),
  toStatus: z.enum(ORDER_STATUSES).optional(),
  agentId: z.string().nullable().optional(),
  providerId: z.string().nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export type BulkOrderActionInput = z.infer<typeof bulkOrderActionSchema>;
