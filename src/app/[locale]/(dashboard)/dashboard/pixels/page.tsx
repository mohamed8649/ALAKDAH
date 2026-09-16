import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { PixelsManager, type PixelRow } from '@/features/pixels/pixels-manager';
import { getTranslations } from '@/i18n/server';
import { suggestedMapping } from '@/server/catalog/pixels';
import { requirePermission } from '@/server/policies/context';
import { listPixels } from '@/server/services/pixel-service';

export const metadata: Metadata = { title: 'البكسلات' };
export const dynamic = 'force-dynamic';

export default async function PixelsPage({ params }: { params: { locale: string } }) {
  const context = await requirePermission('pixels.manage');
  const t = getTranslations(params.locale, 'pixels');
  const pixels = await listPixels(context);

  const rows: PixelRow[] = pixels.map((card) => ({
    providerKey: card.provider.key,
    nameAr: card.provider.nameAr,
    icon: card.provider.icon,
    idPlaceholder: card.provider.idPlaceholder,
    standardEvents: [...card.provider.standardEvents],
    supportsServerToken: card.provider.supportsServerToken,
    pixelId: card.pixelId,
    isActive: card.isActive,
    eventMapping: card.eventMapping as Record<string, string>,
    hasServerToken: card.hasServerToken,
    serverTokenMask: card.serverTokenMask,
    // A suggestion the merchant has to ask for; the revenue events are left
    // out of it deliberately.
    suggested: Object.fromEntries(
      Object.entries(suggestedMapping(card.provider)).filter(([, value]) => Boolean(value)),
    ) as Record<string, string>,
  }));

  return (
    <div>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <PixelsManager pixels={rows} />
    </div>
  );
}
