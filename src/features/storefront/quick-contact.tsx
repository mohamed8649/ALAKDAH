'use client';

import { MessageCircle, Phone } from 'lucide-react';

import { useTranslations } from '@/i18n/provider';
import { toTelLink, toWhatsAppLink } from '@/lib/phone';

/**
 * Floating contact buttons.
 *
 * WhatsApp is a deep link (wa.me), not the Business API — tapping it opens the
 * customer's own WhatsApp with the store's number. Positioned clear of the
 * sticky mobile CTA so the two never overlap.
 */
export function QuickContact({
  phone,
  whatsapp,
  country,
}: {
  phone: string | null;
  whatsapp: string | null;
  country: string;
}) {
  const t = useTranslations('storefront.quickContact');

  if (!phone && !whatsapp) return null;

  return (
    <div className="fixed bottom-4 z-20 flex flex-col gap-2 inset-inline-end-0 end-4 print:hidden">
      {whatsapp ? (
        <a
          href={toWhatsAppLink(whatsapp, country)}
          target="_blank"
          rel="noreferrer"
          aria-label={t('whatsapp')}
          className="flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-overlay transition-transform duration-fast hover:scale-105"
        >
          <MessageCircle className="size-5" aria-hidden />
        </a>
      ) : null}

      {phone ? (
        <a
          href={toTelLink(phone, country)}
          aria-label={t('call')}
          className="flex size-12 items-center justify-center rounded-full bg-primary text-[var(--primary-foreground)] shadow-overlay transition-transform duration-fast hover:scale-105"
        >
          <Phone className="size-5" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
