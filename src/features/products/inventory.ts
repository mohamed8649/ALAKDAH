/**
 * Inventory state derivation.
 *
 * Pure so the same rule renders a badge in the dashboard, gates the storefront
 * "add to cart" button, and validates a checkout on the server. A merchant must
 * never see "in stock" in one place and "out of stock" in another.
 */

export type StockState = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NOT_TRACKED';

export interface StockInput {
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
}

export function stockState(input: StockInput): StockState {
  if (!input.trackInventory) return 'NOT_TRACKED';
  if (input.stockQuantity <= 0) return 'OUT_OF_STOCK';
  if (input.stockQuantity <= input.lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/** Whether a quantity can be sold right now. */
export function canFulfil(input: StockInput, quantity: number): boolean {
  if (quantity <= 0) return false;
  if (!input.trackInventory) return true;
  if (input.allowBackorder) return true;
  return input.stockQuantity >= quantity;
}

export function isPurchasable(input: StockInput): boolean {
  return canFulfil(input, 1);
}

export function stockTone(state: StockState): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (state) {
    case 'IN_STOCK':
      return 'success';
    case 'LOW_STOCK':
      return 'warning';
    case 'OUT_OF_STOCK':
      return 'danger';
    case 'NOT_TRACKED':
      return 'neutral';
  }
}
