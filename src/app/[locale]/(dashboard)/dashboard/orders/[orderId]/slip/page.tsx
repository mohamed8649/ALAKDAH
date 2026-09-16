import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { DeliverySlip } from '@/features/shipping/delivery-slip';
import { PrintTrigger } from '@/features/shipping/print-trigger';
import { AppError } from '@/lib/errors';
import { requirePermission } from '@/server/policies/context';
import { getOrder } from '@/server/services/order-service';
import { getDeliverySlipConfig } from '@/server/services/shipping-service';
import { getStore } from '@/server/services/store-service';

export const metadata: Metadata = { title: 'وصل التوصيل', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Printable slip for a real order.
 *
 * Renders outside the dashboard shell — this page is the document, so print
 * gives a clean slip with no navigation around it.
 */
export default async function OrderSlipPage({
  params,
}: {
  params: { locale: string; orderId: string };
}) {
  const context = await requirePermission('shipping.view');

  let order;
  try {
    order = await getOrder(context, params.orderId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const [config, store] = await Promise.all([
    getDeliverySlipConfig(context.storeId),
    getStore(context.storeId),
  ]);

  return (
    <div className="min-h-dvh bg-surface-2 py-6">
      <PrintTrigger />
      <div className="print-area">
        <DeliverySlip
          config={config}
          store={{ name: store.name, phone: store.phone, logoUrl: store.logoUrl }}
          timezone={context.timezone}
          order={{
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            state: order.state,
            city: order.city,
            address: order.address,
            notes: order.notes,
            total: order.total,
            currency: order.currency,
            createdAt: order.createdAt.toISOString(),
            items: order.items.map((item) => ({
              name: item.nameSnapshot,
              variant: item.variantSnapshot,
              quantity: item.quantity,
            })),
          }}
        />
      </div>
    </div>
  );
}
