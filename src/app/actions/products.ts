'use server';

import { revalidatePath } from 'next/cache';

import { fail, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { requireStoreContext } from '@/server/policies/context';
import { adjustStock } from '@/server/services/inventory-service';
import {
  archiveProduct,
  createProduct,
  searchProductsForPicker,
  updateProduct,
} from '@/server/services/product-service';
import { inventoryAdjustmentSchema, productInputSchema } from '@/validators/product';

import { zodFieldErrors } from './helpers';

/**
 * Product server actions.
 *
 * Each one re-validates, re-authorises, mutates through the service layer, then
 * revalidates the affected paths so the merchant's next navigation shows fresh
 * data rather than a stale cached page.
 */

export async function createProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid product.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    const product = await createProduct(context, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/products', 'page');
    return ok(product);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateProductAction(
  productId: string,
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid product.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    const product = await updateProduct(context, productId, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/products', 'page');
    revalidatePath(`/[locale]/(dashboard)/dashboard/products/${productId}`, 'page');
    return ok(product);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function archiveProductAction(productId: string): Promise<ActionResult> {
  try {
    const context = await requireStoreContext();
    await archiveProduct(context, productId);
    revalidatePath('/[locale]/(dashboard)/dashboard/products', 'page');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function adjustStockAction(input: unknown): Promise<ActionResult<{ newQuantity: number }>> {
  const parsed = inventoryAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', 'Invalid adjustment.', {
      fieldErrors: zodFieldErrors(parsed.error),
    });
  }

  try {
    const context = await requireStoreContext();
    const result = await adjustStock(context, parsed.data);
    revalidatePath('/[locale]/(dashboard)/dashboard/products', 'page');
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function searchProductsAction(search: string) {
  try {
    const context = await requireStoreContext();
    const products = await searchProductsForPicker(context, search.trim(), 20);
    return ok(products);
  } catch (error) {
    return toActionResult(error);
  }
}
