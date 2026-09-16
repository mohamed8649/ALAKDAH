import 'server-only';

import { prisma } from '@/db/client';
import { AppError } from '@/lib/errors';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import {
  DEFAULT_THEME_KEY,
  getTheme,
  resolveThemeTokens,
  THEMES,
  type ThemeTokens,
} from '@/server/catalog/themes';

import { recordAudit } from './audit-service';
import { assertFeature } from './billing-service';

/**
 * Themes.
 *
 * A theme carries tokens *and* a section composition, so activating one changes
 * the structure of the storefront, not just its accent colour. Installing is
 * separate from activating: a merchant can install several and preview them
 * without their live shop changing.
 */

export interface ThemeCard {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  previewImage: string | null;
  isPremium: boolean;
  isInstalled: boolean;
  isActive: boolean;
  tokens: ThemeTokens;
}

export async function listThemes(context: StoreContext): Promise<ThemeCard[]> {
  assertPermission(context, 'themes.manage');

  const config = await prisma.storeTheme.findUnique({
    where: { storeId: context.storeId },
    select: { themeKey: true, installedThemes: true },
  });

  const installed = new Set(config?.installedThemes ?? [DEFAULT_THEME_KEY]);
  const activeKey = config?.themeKey ?? DEFAULT_THEME_KEY;

  return THEMES.map((theme) => ({
    key: theme.key,
    nameAr: theme.nameAr,
    nameEn: theme.nameEn,
    descriptionAr: theme.descriptionAr,
    previewImage: theme.previewImage,
    isPremium: theme.isPremium,
    isInstalled: installed.has(theme.key),
    isActive: theme.key === activeKey,
    tokens: theme.tokens,
  }));
}

export async function installTheme(context: StoreContext, themeKey: string): Promise<void> {
  assertPermission(context, 'themes.manage');
  await assertFeature(context.storeId, 'themes');

  const theme = getTheme(themeKey);
  if (!theme) throw new AppError('NOT_FOUND', 'Theme not found.');

  const config = await prisma.storeTheme.findUnique({
    where: { storeId: context.storeId },
    select: { installedThemes: true },
  });

  const installed = new Set(config?.installedThemes ?? [DEFAULT_THEME_KEY]);
  installed.add(themeKey);

  await prisma.storeTheme.upsert({
    where: { storeId: context.storeId },
    create: {
      storeId: context.storeId,
      themeKey: DEFAULT_THEME_KEY,
      installedThemes: [...installed],
    },
    update: { installedThemes: [...installed] },
  });
}

export async function activateTheme(context: StoreContext, themeKey: string): Promise<void> {
  assertPermission(context, 'themes.manage');
  await assertFeature(context.storeId, 'themes');

  const theme = getTheme(themeKey);
  if (!theme) throw new AppError('NOT_FOUND', 'Theme not found.');

  const config = await prisma.storeTheme.findUnique({
    where: { storeId: context.storeId },
    select: { themeKey: true, installedThemes: true },
  });

  // Activating implies installing — a merchant who picks a theme from the store
  // should not have to press two buttons.
  const installed = new Set(config?.installedThemes ?? [DEFAULT_THEME_KEY]);
  installed.add(themeKey);

  await prisma.storeTheme.upsert({
    where: { storeId: context.storeId },
    create: { storeId: context.storeId, themeKey, installedThemes: [...installed] },
    update: { themeKey, installedThemes: [...installed] },
  });

  await recordAudit(context, {
    action: 'THEME_ACTIVATED',
    entityType: 'store_theme',
    entityId: themeKey,
    before: { themeKey: config?.themeKey ?? null },
    after: { themeKey },
  });
}

export async function getStoreTheme(storeId: string) {
  const config = await prisma.storeTheme.findUnique({ where: { storeId } });
  const themeKey = config?.themeKey ?? DEFAULT_THEME_KEY;

  return {
    themeKey,
    tokens: resolveThemeTokens(
      themeKey,
      (config?.tokenOverrides as Partial<ThemeTokens> | null) ?? null,
    ),
    sections: getTheme(themeKey)?.sections ?? [],
    installedThemes: config?.installedThemes ?? [DEFAULT_THEME_KEY],
  };
}

export interface DesignInput {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  announcementEnabled: boolean;
  announcementText: string | null;
}

export async function updateDesign(context: StoreContext, input: DesignInput): Promise<void> {
  assertPermission(context, 'storefront.manage');

  await prisma.store.update({
    where: { id: context.storeId },
    data: {
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      fontFamily: input.fontFamily,
      logoUrl: input.logoUrl,
      faviconUrl: input.faviconUrl,
      announcementEnabled: input.announcementEnabled,
      announcementText: input.announcementText,
    },
  });

  await recordAudit(context, {
    action: 'SETTINGS_UPDATED',
    entityType: 'store_design',
    entityId: context.storeId,
    after: { primaryColor: input.primaryColor, fontFamily: input.fontFamily },
  });
}
