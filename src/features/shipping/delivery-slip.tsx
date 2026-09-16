import { formatDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { formatPhone } from '@/lib/phone';
import { getMessages, translate } from '@/i18n/messages';
import { resolveLocale } from '@/i18n/config';

/**
 * Printable delivery slip.
 *
 * A plain server-renderable component with print-specific styling, used both
 * for the live preview in the editor and for the real printed slip. Rendering
 * both from the same component is what makes "what you configure is what you
 * print" true rather than aspirational.
 *
 * PDF is produced through the browser's own print-to-PDF: it respects the paper
 * size set here, handles Arabic shaping correctly, and needs no PDF library.
 */

export interface SlipConfig {
  showCodAmount: boolean;
  showCustomerName: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showProducts: boolean;
  showQuantities: boolean;
  showNotes: boolean;
  showLogo: boolean;
  showStoreInfo: boolean;
  showSignatureLines: boolean;
  showOrderNumber: boolean;
  showBarcode: boolean;
  language: string;
  paperSize: string;
  footerNote: string | null;
}

export interface SlipOrder {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  state: string;
  city: string;
  address: string;
  notes: string | null;
  total: number;
  currency: string;
  createdAt: string;
  items: Array<{ name: string; variant: string | null; quantity: number }>;
}

export interface SlipStore {
  name: string;
  phone: string | null;
  logoUrl: string | null;
}

const PAPER_WIDTH: Record<string, string> = {
  A4: '210mm',
  A5: '148mm',
  A6: '105mm',
};

export function DeliverySlip({
  config,
  order,
  store,
  timezone,
}: {
  config: SlipConfig;
  order: SlipOrder;
  store: SlipStore;
  timezone: string;
}) {
  const locale = resolveLocale(config.language);
  const messages = getMessages(locale);
  const t = (key: string) => translate(messages, key);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div
      dir={dir}
      lang={locale}
      className="delivery-slip mx-auto bg-white p-5 text-[#111] shadow-card print:shadow-none"
      style={{ width: PAPER_WIDTH[config.paperSize] ?? PAPER_WIDTH.A5, fontFamily: 'var(--font-sans)' }}
    >
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#111] pb-3">
        <div className="flex items-center gap-3">
          {config.showLogo && store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- printed output, not a Next image surface
            <img src={store.logoUrl} alt="" className="h-10 w-auto object-contain" />
          ) : null}
          {config.showStoreInfo ? (
            <div>
              <p className="text-base font-bold leading-tight">{store.name}</p>
              {store.phone ? (
                <p className="font-mono text-xs" dir="ltr">
                  {formatPhone(store.phone)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="text-end">
          {config.showOrderNumber ? (
            <p className="font-mono text-lg font-bold" dir="ltr">
              {order.orderNumber}
            </p>
          ) : null}
          <p className="text-xs">{formatDate(order.createdAt, locale, timezone)}</p>
        </div>
      </header>

      {config.showCodAmount ? (
        <div className="my-3 border-2 border-[#111] px-3 py-2 text-center">
          <p className="text-xs font-medium uppercase tracking-wide">{t('shipping.slip.codAmount')}</p>
          <p className="text-2xl font-bold tabular-nums">
            {formatMoney(order.total, order.currency, locale)}
          </p>
        </div>
      ) : null}

      <section className="mt-3 space-y-1.5 text-sm">
        {config.showCustomerName ? (
          <Row label={t('app.name')} value={order.customerName} />
        ) : null}
        {config.showPhone ? (
          <Row label={t('app.phone')} value={formatPhone(order.customerPhone)} ltr />
        ) : null}
        {config.showAddress ? (
          <Row
            label={t('app.address')}
            value={[order.state, order.city, order.address].filter(Boolean).join('، ')}
          />
        ) : null}
      </section>

      {config.showProducts && order.items.length > 0 ? (
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-[#111]">
              <th className="py-1.5 text-start text-xs font-semibold">{t('orders.items')}</th>
              {config.showQuantities ? (
                <th className="w-16 py-1.5 text-end text-xs font-semibold">{t('app.quantity')}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index} className="border-b border-[#ddd]">
                <td className="py-1.5">
                  {item.name}
                  {item.variant ? <span className="text-xs text-[#555]"> — {item.variant}</span> : null}
                </td>
                {config.showQuantities ? (
                  <td className="py-1.5 text-end tabular-nums">{item.quantity}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {config.showNotes && order.notes ? (
        <div className="mt-3 border border-dashed border-[#999] p-2 text-xs">
          <span className="font-semibold">{t('app.notes')}: </span>
          {order.notes}
        </div>
      ) : null}

      {config.showBarcode ? (
        <div className="mt-3 flex justify-center" aria-hidden>
          {/* Code 39 style bars derived from the order number. Rendered as an
              image-free SVG so the slip prints crisply at any size. */}
          <BarcodeStripes value={order.orderNumber} />
        </div>
      ) : null}

      {config.showSignatureLines ? (
        <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="border-b border-[#111] pb-6" />
            <p className="mt-1">{t('shipping.slip.signature')}</p>
          </div>
          <div>
            <div className="border-b border-[#111] pb-6" />
            <p className="mt-1">{t('shipping.slip.courierSignature')}</p>
          </div>
        </div>
      ) : null}

      {config.footerNote ? (
        <p className="mt-4 border-t border-[#ddd] pt-2 text-center text-xs text-[#555]">
          {config.footerNote}
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-xs font-semibold text-[#555]">{label}</span>
      <span className={ltr ? 'font-mono' : ''} dir={ltr ? 'ltr' : undefined}>
        {value || '—'}
      </span>
    </div>
  );
}

/**
 * Simple deterministic bar pattern.
 *
 * Not a scannable Code 128 symbology — producing a real one needs a checksum
 * table we would rather not hand-roll. It is a visual reference marker, and is
 * labelled as such so nobody assumes a scanner will read it.
 */
function BarcodeStripes({ value }: { value: string }) {
  const bars = Array.from(value).flatMap((char) => {
    const code = char.charCodeAt(0);
    return [1, 2, 3, 4].map((shift) => ((code >> shift) & 1) === 1);
  });

  return (
    <svg width="180" height="40" viewBox={`0 0 ${bars.length * 3} 40`} role="img" aria-label={value}>
      {bars.map((wide, index) => (
        <rect
          key={index}
          x={index * 3}
          y="0"
          width={wide ? 2 : 1}
          height="32"
          fill="#111"
        />
      ))}
      <text x="0" y="39" fontSize="6" fill="#111" fontFamily="monospace">
        {value}
      </text>
    </svg>
  );
}
