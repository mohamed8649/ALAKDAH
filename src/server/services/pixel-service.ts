import 'server-only';

import { prisma } from '@/db/client';
import { decryptJson, encryptJson, maskSecret } from '@/lib/crypto';
import { AppError } from '@/lib/errors';
import {
  getPixelProvider,
  PIXEL_PROVIDERS,
  TRACKABLE_EVENTS,
  type EventMapping,
  type PixelProvider,
  type TrackableEvent,
} from '@/server/catalog/pixels';
import { assertPermission, type StoreContext } from '@/server/policies/context';

import { recordAudit } from './audit-service';
import { assertFeature } from './billing-service';

/**
 * Pixel configuration.
 *
 * A pixel only fires for events the merchant explicitly mapped. An unmapped
 * event is not forwarded — see `catalog/pixels.ts` for why that default is
 * deliberate rather than lazy.
 *
 * Conversions-API tokens are credentials: encrypted at rest, masked on read.
 */

export interface PixelCard {
  provider: PixelProvider;
  pixelId: string;
  isActive: boolean;
  eventMapping: EventMapping;
  hasServerToken: boolean;
  serverTokenMask: string | null;
}

export async function listPixels(context: StoreContext): Promise<PixelCard[]> {
  assertPermission(context, 'pixels.manage');

  const rows = await prisma.pixelIntegration.findMany({ where: { storeId: context.storeId } });
  const byKey = new Map(rows.map((row) => [row.providerKey, row]));

  return PIXEL_PROVIDERS.map((provider) => {
    const row = byKey.get(provider.key);
    const token = row?.accessTokenEncrypted
      ? decryptJson<{ token: string }>(row.accessTokenEncrypted)
      : null;

    return {
      provider,
      pixelId: row?.pixelId ?? '',
      isActive: row?.isActive ?? false,
      eventMapping: normaliseMapping(provider, row?.eventMapping),
      hasServerToken: Boolean(token?.token),
      serverTokenMask: token?.token ? maskSecret(token.token) : null,
    };
  });
}

/** Drop anything that is not one of our events mapped to one of theirs. */
function normaliseMapping(provider: PixelProvider, raw: unknown): EventMapping {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const mapping: EventMapping = {};

  for (const event of TRACKABLE_EVENTS) {
    const value = source[event];
    if (typeof value !== 'string' || value.length === 0) continue;
    if (!provider.standardEvents.includes(value)) continue;
    mapping[event] = value;
  }

  return mapping;
}

export interface PixelSaveInput {
  providerKey: string;
  pixelId: string;
  isActive: boolean;
  eventMapping: Record<string, string>;
  /** Blank keeps whatever is stored; this is write-only. */
  serverToken?: string;
}

export async function savePixel(context: StoreContext, input: PixelSaveInput): Promise<void> {
  assertPermission(context, 'pixels.manage');
  await assertFeature(context.storeId, 'pixels');

  const provider = getPixelProvider(input.providerKey);
  if (!provider) throw new AppError('NOT_FOUND', 'Pixel provider not found.');

  const pixelId = input.pixelId.trim();

  // A pixel with no id cannot be active — better to reject than to render a
  // broken script tag on every storefront page.
  if (input.isActive && !pixelId) {
    throw new AppError('VALIDATION_FAILED', 'Pixel id is required.', {
      fieldErrors: { pixelId: ['validation.required'] },
    });
  }
  if (pixelId && !provider.idPattern.test(pixelId)) {
    throw new AppError('VALIDATION_FAILED', 'Pixel id has the wrong shape.', {
      fieldErrors: { pixelId: ['validation.invalidPixelId'] },
    });
  }

  const mapping = normaliseMapping(provider, input.eventMapping);

  const existing = await prisma.pixelIntegration.findUnique({
    where: { storeId_providerKey: { storeId: context.storeId, providerKey: provider.key } },
    select: { accessTokenEncrypted: true },
  });

  const submittedToken = input.serverToken?.trim() ?? '';
  const accessTokenEncrypted = !provider.supportsServerToken
    ? null
    : submittedToken.length > 0
      ? encryptJson({ token: submittedToken })
      : (existing?.accessTokenEncrypted ?? null);

  const data = {
    pixelId,
    isActive: input.isActive,
    eventMapping: mapping as object,
    accessTokenEncrypted,
  };

  await prisma.pixelIntegration.upsert({
    where: { storeId_providerKey: { storeId: context.storeId, providerKey: provider.key } },
    create: { storeId: context.storeId, providerKey: provider.key, ...data },
    update: data,
  });

  await recordAudit(context, {
    action: 'PIXEL_UPDATED',
    entityType: 'pixel',
    entityId: provider.key,
    // The mapped event names are configuration; the token is not recorded.
    after: { isActive: input.isActive, mappedEvents: Object.keys(mapping) },
  });
}

export async function removePixel(context: StoreContext, providerKey: string): Promise<void> {
  assertPermission(context, 'pixels.manage');

  const result = await prisma.pixelIntegration.deleteMany({
    where: { storeId: context.storeId, providerKey },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Pixel not found.');

  await recordAudit(context, {
    action: 'PIXEL_UPDATED',
    entityType: 'pixel',
    entityId: providerKey,
    after: { removed: true },
  });
}

export interface ActivePixel {
  providerKey: string;
  pixelId: string;
  scriptDomain: string;
  eventMapping: EventMapping;
}

/**
 * What the storefront is allowed to load.
 *
 * Returns only active pixels with a valid id, and only the mapping — never the
 * server token, which has no business in a browser bundle.
 */
export async function getActivePixels(storeId: string): Promise<ActivePixel[]> {
  const rows = await prisma.pixelIntegration.findMany({
    where: { storeId, isActive: true, pixelId: { not: '' } },
    select: { providerKey: true, pixelId: true, eventMapping: true },
  });

  return rows.flatMap((row) => {
    const provider = getPixelProvider(row.providerKey);
    if (!provider || !provider.idPattern.test(row.pixelId)) return [];

    return [
      {
        providerKey: row.providerKey,
        pixelId: row.pixelId,
        scriptDomain: provider.scriptDomain,
        eventMapping: normaliseMapping(provider, row.eventMapping),
      },
    ];
  });
}

/** The provider-side name for one of our events, or null when unmapped. */
export function mappedEventName(pixel: ActivePixel, event: TrackableEvent): string | null {
  return pixel.eventMapping[event] ?? null;
}
