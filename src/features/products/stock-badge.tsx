'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/i18n/provider';
import { formatNumber } from '@/lib/money';

import { stockState, stockTone, type StockInput } from './inventory';

/**
 * Stock chip.
 *
 * Shows the count next to the state so a merchant sees "low stock · 3" rather
 * than an amber pill they have to open the product to interpret.
 */
export function StockBadge({
  product,
  locale,
  showCount = true,
}: {
  product: StockInput;
  locale: string;
  showCount?: boolean;
}) {
  const t = useTranslations('products.inventory.state');
  const state = stockState(product);

  return (
    <Badge tone={stockTone(state)}>
      {t(state)}
      {showCount && product.trackInventory ? (
        <span className="tabular-nums opacity-80">· {formatNumber(product.stockQuantity, locale)}</span>
      ) : null}
    </Badge>
  );
}
