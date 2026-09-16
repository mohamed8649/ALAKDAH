'use server';

import { revalidatePath } from 'next/cache';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireAnyContext, requireStoreContext } from '@/server/policies/context';
import {
  bulkOrderAction,
  changeOrderStatus,
  createManualOrder,
  exportOrders,
  updateOrder,
  type BulkResult,
  type ExportResult,
} from '@/server/services/order-service';
import {
  bulkOrderActionSchema,
  manualOrderSchema,
  orderFilterSchema,
  orderStatusChangeSchema,
  orderUpdateSchema,
} from '@/validators/order';

import { zodFieldErrors } from './helpers';

/**
 * Order actions.
 *
 * Status changes accept either realm (merchant or call-center agent); the
 * service applies the narrower agent scope. Everything else requires a merchant
 * session.
 */

export async function createManualOrderAction(
  input: unknown,
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  const parsed = manualOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid order.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireAnyContext();
    const order = await createManualOrder(context, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/orders', 'page');
    return ok(order);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function changeOrderStatusAction(
  input: unknown,
): Promise<ActionResult<{ status: string; alreadyApplied: boolean }>> {
  const parsed = orderStatusChangeSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid status change.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireAnyContext();
    const result = await changeOrderStatus(context, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/orders', 'page');
    revalidatePath(`/[locale]/(dashboard)/dashboard/orders/${parsed.data.orderId}`, 'page');
    revalidatePath('/[locale]/(agent)/agent/orders', 'page');
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = orderUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid update.', { fieldErrors: zodFieldErrors(parsed.error) });
  }

  try {
    const context = await requireAnyContext();
    await updateOrder(context, parsed.data);
    revalidatePath(`/[locale]/(dashboard)/dashboard/orders/${parsed.data.orderId}`, 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function bulkOrderActionAction(input: unknown): Promise<ActionResult<BulkResult>> {
  const parsed = bulkOrderActionSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid bulk action.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    const result = await bulkOrderAction(context, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/orders', 'page');
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Export honours the current filters and the caller's scope. An empty result is
 * returned as `rowCount: 0` so the UI can explain it rather than downloading an
 * empty file.
 */
export async function exportOrdersAction(filter: unknown): Promise<ActionResult<ExportResult>> {
  const parsed = orderFilterSchema.safeParse(filter);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid filters.');
  }

  try {
    const context = await requireStoreContext();
    return ok(await exportOrders(context, parsed.data));
  } catch (error) {
    return toActionResult(error);
  }
}
