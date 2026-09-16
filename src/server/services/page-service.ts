import 'server-only';

import { prisma } from '@/db/client';
import { normaliseDocument, type PageDocument } from '@/features/pages/blocks';
import { AppError } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/lib/slug';
import { assertPermission, type StoreContext } from '@/server/policies/context';

import { recordAudit } from './audit-service';
import { assertFeature, assertWithinLimit } from './billing-service';

/**
 * Landing pages.
 *
 * Both creation paths — the manual builder and the AI generator — converge on
 * the same `PageDocument`, so a generated page is editable in the builder and a
 * hand-built page renders through the same component tree.
 *
 * Every document is re-normalised on save: whatever the client posts, only
 * known block types with schema-valid props reach the database.
 */

export interface PageListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  conversions: number;
  generatedByAi: boolean;
  blockCount: number;
  updatedAt: Date;
}

export async function listPages(context: StoreContext): Promise<PageListItem[]> {
  assertPermission(context, 'pages.view');

  const pages = await prisma.landingPage.findMany({
    where: { storeId: context.storeId, archivedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      views: true,
      conversions: true,
      generatedByAi: true,
      document: true,
      updatedAt: true,
    },
  });

  return pages.map((page) => {
    const document = normaliseDocument(page.document);
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      views: page.views,
      conversions: page.conversions,
      generatedByAi: page.generatedByAi,
      blockCount: document.blocks.length,
      updatedAt: page.updatedAt,
    };
  });
}

export async function getPage(context: StoreContext, pageId: string) {
  assertPermission(context, 'pages.view');

  const page = await prisma.landingPage.findFirst({
    where: { id: pageId, storeId: context.storeId },
  });
  if (!page) throw new AppError('NOT_FOUND', 'Page not found.');

  return { ...page, document: normaliseDocument(page.document) };
}

export interface PageSaveInput {
  title: string;
  slug?: string;
  productId?: string | null;
  /** Optional because Zod's `unknown()` yields an optional key; a missing
   *  document normalises to an empty block list. */
  document?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status?: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  generatedByAi?: boolean;
  aiPreset?: string | null;
}

export async function savePage(
  context: StoreContext,
  pageId: string | null,
  input: PageSaveInput,
): Promise<{ id: string; slug: string }> {
  assertPermission(context, 'pages.manage');
  await assertFeature(context.storeId, 'landing_pages');

  if (!pageId) await assertWithinLimit(context.storeId, 'landing_pages');

  // Whatever the client posted, only schema-valid blocks are stored.
  const document = normaliseDocument(input.document);

  const base = input.slug && input.slug.length > 0 ? input.slug : slugify(input.title, 'page');
  const conflicts = await prisma.landingPage.findMany({
    where: {
      storeId: context.storeId,
      slug: { startsWith: base },
      ...(pageId ? { NOT: { id: pageId } } : {}),
    },
    select: { slug: true },
  });
  const slug = uniqueSlug(base, new Set(conflicts.map((row) => row.slug)));

  if (input.productId) {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, storeId: context.storeId },
      select: { id: true },
    });
    if (!product) throw new AppError('NOT_FOUND', 'Product not found.');
  }

  const data = {
    title: input.title,
    slug,
    productId: input.productId ?? null,
    document: document as unknown as object,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
    ...(input.generatedByAi !== undefined ? { generatedByAi: input.generatedByAi } : {}),
    ...(input.aiPreset !== undefined ? { aiPreset: input.aiPreset } : {}),
  };

  if (pageId) {
    const existing = await prisma.landingPage.findFirst({
      where: { id: pageId, storeId: context.storeId },
      select: { id: true },
    });
    if (!existing) throw new AppError('NOT_FOUND', 'Page not found.');

    await prisma.landingPage.update({ where: { id: pageId }, data });

    if (input.status === 'PUBLISHED') {
      await recordAudit(context, {
        action: 'PAGE_PUBLISHED',
        entityType: 'landing_page',
        entityId: pageId,
        after: { title: input.title, slug },
      });
    }

    return { id: pageId, slug };
  }

  const page = await prisma.landingPage.create({
    data: { ...data, storeId: context.storeId, locale: context.locale },
    select: { id: true },
  });

  return { id: page.id, slug };
}

export async function setPageStatus(
  context: StoreContext,
  pageId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED',
): Promise<void> {
  assertPermission(context, 'pages.manage');

  const result = await prisma.landingPage.updateMany({
    where: { id: pageId, storeId: context.storeId },
    data: {
      status,
      ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
    },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Page not found.');

  if (status === 'PUBLISHED') {
    await recordAudit(context, {
      action: 'PAGE_PUBLISHED',
      entityType: 'landing_page',
      entityId: pageId,
      after: { status },
    });
  }
}

export async function archivePage(context: StoreContext, pageId: string): Promise<void> {
  assertPermission(context, 'pages.manage');

  const result = await prisma.landingPage.updateMany({
    where: { id: pageId, storeId: context.storeId },
    data: { archivedAt: new Date(), status: 'UNPUBLISHED' },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Page not found.');
}

/** Public read for the storefront. Only published pages are reachable. */
export async function getPublishedPage(storeId: string, slug: string) {
  const page = await prisma.landingPage.findFirst({
    where: { storeId, slug, status: 'PUBLISHED', archivedAt: null },
  });
  if (!page) return null;

  // Fire-and-forget view counter; a failure must not break the page.
  void prisma.landingPage
    .update({ where: { id: page.id }, data: { views: { increment: 1 } } })
    .catch(() => undefined);

  return { ...page, document: normaliseDocument(page.document) as PageDocument };
}
