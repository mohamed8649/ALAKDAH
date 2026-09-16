'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/i18n/provider';

/**
 * Print control for the standalone slip page.
 *
 * Deliberately does not auto-print on mount: an unexpected print dialog on page
 * load is hostile, and a merchant may want to check the slip first.
 */
export function PrintTrigger() {
  const t = useTranslations('shipping.slip');

  return (
    <div className="no-print mb-4 flex justify-center">
      <Button variant="primary" size="touch" onClick={() => window.print()}>
        <Printer aria-hidden />
        {t('print')}
      </Button>
    </div>
  );
}
