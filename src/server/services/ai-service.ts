import 'server-only';

import { prisma } from '@/db/client';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getAiProvider } from '@/server/ai/provider';
import { assertPermission, type StoreContext } from '@/server/policies/context';
import { getStorage } from '@/server/storage';

import { assertFeature, assertWithinLimit } from './billing-service';

/**
 * AI service.
 *
 * Every generation is metered and recorded before the merchant sees it:
 * provider, model, tokens in and out, an estimated cost and who asked. Cost is
 * computed here from the provider's reported usage — never from anything the
 * browser sends.
 *
 * Nothing generated here is saved to the product or page automatically. The
 * service returns a draft; the merchant reviews it, edits it, and saves it
 * through the normal product or page action.
 */

export interface ProductDescriptionRequest {
  productName: string;
  category?: string | null;
  features: string[];
  tone: 'professional' | 'friendly' | 'luxury' | 'energetic' | 'simple';
  length: 'short' | 'medium' | 'long';
  language: 'ar' | 'en';
  instructions?: string | null;
}

export interface GenerationDraft {
  id: string;
  text: string;
  creditsUsed: number;
}

const PRODUCT_DESCRIPTION_SYSTEM = [
  'أنت كاتب محتوى تجاري عربي محترف تكتب أوصاف منتجات لمتجر إلكتروني يعتمد الدفع عند الاستلام.',
  'اكتب بلغة عربية فصيحة وبسيطة يفهمها المشتري العادي.',
  'لا تخترع مواصفات تقنية أو أرقاماً أو شهادات لم يذكرها التاجر.',
  'لا تستخدم علامات HTML أو أكواد.',
  'لا تَعِد بالتوصيل المجاني أو بسياسة إرجاع ما لم تُذكر صراحة.',
].join(' ');

export async function generateProductDescription(
  context: StoreContext,
  request: ProductDescriptionRequest,
): Promise<GenerationDraft> {
  assertPermission(context, 'ai.use');
  await assertFeature(context.storeId, 'ai_tools');
  await assertWithinLimit(context.storeId, 'ai_credits');
  enforceRateLimit('aiGeneration', context.storeId);

  const provider = getAiProvider();

  // The generation row is created first, so a failed call is still recorded
  // and a merchant can see that an attempt was made and what it cost.
  const generation = await prisma.aiGeneration.create({
    data: {
      storeId: context.storeId,
      kind: 'PRODUCT_DESCRIPTION',
      provider: provider.key,
      model: provider.model,
      status: 'PENDING',
      requestedBy: context.actor.id,
      resourceType: 'product',
      prompt: JSON.parse(JSON.stringify(request)) as object,
    },
    select: { id: true },
  });

  try {
    const result = await provider.complete({
      system: PRODUCT_DESCRIPTION_SYSTEM,
      prompt: JSON.stringify({
        name: request.productName,
        category: request.category ?? null,
        features: request.features,
        tone: request.tone,
        length: request.length,
        language: request.language,
        instructions: request.instructions ?? null,
      }),
      maxTokens: request.length === 'long' ? 1200 : request.length === 'medium' ? 700 : 400,
      seed: generation.id,
    });

    await prisma.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: 'SUCCEEDED',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costMicros: result.costMicros,
        creditsUsed: 1,
        result: { text: result.text },
      },
    });

    return { id: generation.id, text: result.text, creditsUsed: 1 };
  } catch (error) {
    await prisma.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: 'FAILED',
        // A failed generation costs no credit.
        creditsUsed: 0,
        errorMessage: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
      },
    });

    logger.error('ai generation failed', error, {
      storeId: context.storeId,
      entityType: 'ai_generation',
      entityId: generation.id,
    });

    throw error instanceof AppError
      ? error
      : new AppError('AI_GENERATION_FAILED', 'Generation failed.');
  }
}

// ---------------------------------------------------------------------------
// Landing page generation
// ---------------------------------------------------------------------------

export const COPY_FRAMEWORKS = [
  'AIDA',
  'PAS',
  'STORY_BRAND',
  'PROOF_STACK',
  'OBJECTION_CRUSHER',
  'BAB',
] as const;

export type CopyFramework = (typeof COPY_FRAMEWORKS)[number];

/**
 * Framework definitions.
 *
 * Each framework dictates the *block order* of the generated page, not just the
 * writing style — a PAS page leads with the problem, a Proof Stack page leads
 * with evidence. The preset is stored on the page so a regeneration is
 * reproducible.
 */
export const FRAMEWORK_BLOCKS: Record<CopyFramework, string[]> = {
  AIDA: ['hero', 'features', 'product', 'testimonials', 'offer', 'orderForm', 'faq'],
  PAS: ['hero', 'text', 'features', 'product', 'trust', 'orderForm'],
  STORY_BRAND: ['hero', 'text', 'features', 'testimonials', 'product', 'cta', 'orderForm'],
  PROOF_STACK: ['hero', 'trust', 'testimonials', 'features', 'product', 'offer', 'orderForm'],
  OBJECTION_CRUSHER: ['hero', 'product', 'faq', 'trust', 'testimonials', 'orderForm'],
  BAB: ['hero', 'text', 'image', 'features', 'product', 'cta', 'orderForm'],
};

export const STYLE_PRESETS = [
  'tech_neon',
  'luxury_black_gold',
  'outdoor_orange',
  'home_lifestyle',
  'clean_aqua',
  'streetwear_dark',
  'beauty_soft',
  'pro_tool',
  'kids_family',
  'offer_blast',
] as const;

export type StylePreset = (typeof STYLE_PRESETS)[number];

/**
 * A style preset is design tokens, not a vague adjective. Storing "luxury" as
 * free text would mean nothing on regeneration; storing the tokens means the
 * page renders identically every time.
 */
export const PRESET_TOKENS: Record<StylePreset, { primary: string; background: string; foreground: string; radius: string; density: 'compact' | 'roomy' }> = {
  tech_neon: { primary: '#00e5ff', background: '#050b16', foreground: '#e6f7ff', radius: '4px', density: 'compact' },
  luxury_black_gold: { primary: '#c8a25a', background: '#0d0d0d', foreground: '#f2ece0', radius: '2px', density: 'roomy' },
  outdoor_orange: { primary: '#f26722', background: '#1a1611', foreground: '#f7efe6', radius: '8px', density: 'compact' },
  home_lifestyle: { primary: '#8a7355', background: '#faf7f2', foreground: '#2c2419', radius: '14px', density: 'roomy' },
  clean_aqua: { primary: '#12b5a5', background: '#ffffff', foreground: '#0f2b2a', radius: '10px', density: 'roomy' },
  streetwear_dark: { primary: '#e8ff3d', background: '#111111', foreground: '#f5f5f5', radius: '0px', density: 'compact' },
  beauty_soft: { primary: '#e08aa6', background: '#fffafc', foreground: '#3b2530', radius: '20px', density: 'roomy' },
  pro_tool: { primary: '#2563eb', background: '#f7f9fc', foreground: '#0f1b2d', radius: '6px', density: 'compact' },
  kids_family: { primary: '#ffb020', background: '#fffdf5', foreground: '#2e2412', radius: '18px', density: 'roomy' },
  offer_blast: { primary: '#ff2d55', background: '#fff7f8', foreground: '#2b0c12', radius: '8px', density: 'compact' },
};

export interface LandingPageRequest {
  productId: string;
  language: 'ar' | 'en';
  framework: CopyFramework;
  preset: StylePreset;
  tone: 'professional' | 'friendly' | 'luxury' | 'energetic' | 'simple';
  length: 'short' | 'medium' | 'long';
  instructions?: string | null;
}

export interface GeneratedPageDraft {
  generationId: string;
  title: string;
  blocks: Array<{ id: string; type: string; props: Record<string, unknown> }>;
}

const LANDING_PAGE_SYSTEM = [
  'أنت كاتب صفحات هبوط عربية للمتاجر التي تعتمد الدفع عند الاستلام.',
  'التزم بإطار الكتابة المطلوب وبترتيب الأقسام المعطى.',
  'اكتب نصاً مقنعاً وواقعياً بدون مبالغة أو ادعاءات كاذبة.',
  'أعد النتيجة نصاً عادياً فقط، بدون HTML أو JavaScript.',
].join(' ');

export async function generateLandingPage(
  context: StoreContext,
  request: LandingPageRequest,
): Promise<GeneratedPageDraft> {
  assertPermission(context, 'ai.use');
  await assertFeature(context.storeId, 'ai_tools');
  await assertWithinLimit(context.storeId, 'ai_credits');
  enforceRateLimit('aiGeneration', context.storeId);

  const product = await prisma.product.findFirst({
    where: { id: request.productId, storeId: context.storeId, archivedAt: null },
    select: {
      id: true,
      name: true,
      shortDescription: true,
      description: true,
      price: true,
      compareAtPrice: true,
      images: { orderBy: { position: 'asc' }, take: 3, select: { url: true } },
    },
  });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.');

  const provider = getAiProvider();

  const generation = await prisma.aiGeneration.create({
    data: {
      storeId: context.storeId,
      kind: 'LANDING_PAGE',
      provider: provider.key,
      model: provider.model,
      status: 'PENDING',
      requestedBy: context.actor.id,
      resourceType: 'landing_page',
      prompt: JSON.parse(JSON.stringify(request)) as object,
    },
    select: { id: true },
  });

  try {
    const blockOrder = FRAMEWORK_BLOCKS[request.framework];

    const result = await provider.complete({
      system: LANDING_PAGE_SYSTEM,
      prompt: JSON.stringify({
        name: product.name,
        category: null,
        features: (product.shortDescription ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        tone: request.tone,
        length: request.length,
        language: request.language,
        framework: request.framework,
        blocks: blockOrder,
        instructions: request.instructions ?? null,
      }),
      maxTokens: 2000,
      seed: generation.id,
    });

    const copy = result.text.split('\n').filter((line) => line.trim());
    const headline = copy[0] ?? product.name;
    const body = copy.slice(1).join('\n');

    const blocks = buildBlocks(blockOrder, {
      productId: product.id,
      productName: product.name,
      headline,
      body,
      imageUrl: product.images[0]?.url ?? null,
      preset: request.preset,
    });

    await prisma.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: 'SUCCEEDED',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costMicros: result.costMicros,
        creditsUsed: 3,
        result: { blocks } as object,
      },
    });

    return { generationId: generation.id, title: headline.slice(0, 120), blocks };
  } catch (error) {
    await prisma.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: 'FAILED',
        creditsUsed: 0,
        errorMessage: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
      },
    });
    throw error instanceof AppError
      ? error
      : new AppError('AI_GENERATION_FAILED', 'Generation failed.');
  }
}

function buildBlocks(
  order: readonly string[],
  input: {
    productId: string;
    productName: string;
    headline: string;
    body: string;
    imageUrl: string | null;
    preset: StylePreset;
  },
): Array<{ id: string; type: string; props: Record<string, unknown> }> {
  const paragraphs = input.body.split('\n\n').filter(Boolean);
  const bullets = input.body
    .split('\n')
    .filter((line) => line.trim().startsWith('•'))
    .map((line) => line.replace(/^•\s*/, '').trim());

  let paragraphIndex = 0;
  const nextParagraph = () => paragraphs[paragraphIndex++] ?? '';

  return order.map((type, index) => {
    const id = `blk_${index}_${Math.random().toString(36).slice(2, 8)}`;

    switch (type) {
      case 'hero':
        return {
          id,
          type,
          props: {
            headline: input.headline,
            subheadline: nextParagraph(),
            imageUrl: input.imageUrl,
            ctaText: 'اطلب الآن',
            align: 'center',
          },
        };
      case 'features':
        return {
          id,
          type,
          props: {
            title: 'لماذا هذا المنتج؟',
            items: (bullets.length > 0 ? bullets : ['جودة موثوقة', 'سعر مناسب', 'توصيل سريع']).map(
              (text) => ({ title: text, description: '' }),
            ),
          },
        };
      case 'product':
        return { id, type, props: { productId: input.productId, showPrice: true } };
      case 'text':
        return { id, type, props: { content: nextParagraph(), align: 'start' } };
      case 'image':
        return { id, type, props: { url: input.imageUrl, alt: input.productName } };
      case 'trust':
        return { id, type, props: { useStoreBadges: true } };
      case 'testimonials':
        // Testimonials are never invented: the block ships empty for the
        // merchant to fill with real reviews.
        return { id, type, props: { items: [], title: 'آراء العملاء' } };
      case 'offer':
        return { id, type, props: { title: 'عرض لفترة محدودة', description: nextParagraph() } };
      case 'faq':
        return {
          id,
          type,
          props: {
            title: 'أسئلة شائعة',
            items: [
              { question: 'كيف أدفع؟', answer: 'الدفع عند الاستلام نقداً للمندوب.' },
              { question: 'كم يستغرق التوصيل؟', answer: 'يعتمد على منطقتك، ونؤكد ذلك عند الاتصال.' },
            ],
          },
        };
      case 'cta':
        return { id, type, props: { text: 'اطلب الآن', headline: input.headline } };
      case 'orderForm':
        return { id, type, props: { productId: input.productId, title: 'أكمل طلبك' } };
      default:
        return { id, type, props: {} };
    }
  });
}

// ---------------------------------------------------------------------------
// Logo generation
// ---------------------------------------------------------------------------

export interface LogoCandidate {
  id: string;
  /** Inline SVG markup, generated locally. */
  svg: string;
  palette: string[];
}

/**
 * Logo suggestions.
 *
 * REBUILD PROPOSAL — the reference shows a logo generator producing candidates
 * that the merchant picks from. We generate deterministic SVG wordmarks locally
 * rather than calling an image model: it is instant, free, offline, and the
 * result is a crisp vector instead of a raster the merchant cannot resize.
 * Swapping in an image model later means replacing this one function.
 *
 * Nothing goes live until the merchant chooses a candidate.
 */
export async function generateLogoCandidates(
  context: StoreContext,
  input: { storeName: string; palette?: string },
): Promise<LogoCandidate[]> {
  assertPermission(context, 'storefront.manage');
  enforceRateLimit('aiGeneration', context.storeId);

  const initials = logoInitials(input.storeName);

  const candidates = LOGO_PALETTES.map((palette, index) => ({
    id: `logo_${index}`,
    palette,
    svg: renderLogoSvg(initials, input.storeName, palette, index),
  }));

  await prisma.aiGeneration.create({
    data: {
      storeId: context.storeId,
      kind: 'LOGO',
      provider: 'local-svg',
      model: 'wordmark-v1',
      status: 'SUCCEEDED',
      creditsUsed: 0,
      requestedBy: context.actor.id,
      resourceType: 'store',
      resourceId: context.storeId,
      prompt: JSON.parse(JSON.stringify(input)) as object,
      result: { count: candidates.length } as object,
    },
  });

  return candidates;
}

/**
 * Adopt one of the generated candidates as the store logo file.
 *
 * The browser sends only the candidate's id, never its markup: the SVG is
 * re-rendered here from the same deterministic function that produced the
 * preview. That means no client-supplied SVG is ever written to disk or served
 * back — which matters, because SVG is an executable document format.
 *
 * This writes the file and returns its URL. It does *not* set the store's
 * logo — the merchant still saves the design form, so a generated logo never
 * goes live on its own.
 */
export async function adoptLogoCandidate(
  context: StoreContext,
  input: { storeName: string; candidateId: string },
): Promise<{ url: string }> {
  assertPermission(context, 'storefront.manage');

  const index = LOGO_PALETTES.findIndex((_, position) => `logo_${position}` === input.candidateId);
  const palette = LOGO_PALETTES[index];
  if (!palette) throw new AppError('NOT_FOUND', 'Logo candidate not found.');

  const svg = renderLogoSvg(logoInitials(input.storeName), input.storeName, palette, index);

  const stored = await getStorage().put({
    storeId: context.storeId,
    folder: 'branding',
    filename: `logo-${input.candidateId}.svg`,
    contentType: 'image/svg+xml',
    data: Buffer.from(svg, 'utf8'),
  });

  return { url: stored.url };
}

const LOGO_PALETTES: string[][] = [
  ['#00b77b', '#04150e'],
  ['#3b9df5', '#081625'],
  ['#f2a33c', '#20160a'],
  ['#8b7cf6', '#150f2b'],
  ['#e0577a', '#2a0f18'],
  ['#16c98d', '#06201a'],
];

function logoInitials(storeName: string): string {
  const initials = storeName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');

  return initials || 'A';
}

function renderLogoSvg(
  initials: string,
  storeName: string,
  palette: string[],
  variant: number,
): string {
  const [accent = '#00b77b', dark = '#04150e'] = palette;
  const safeInitials = escapeXml(initials.slice(0, 2));
  const safeName = escapeXml(storeName.slice(0, 22));

  const shape =
    variant % 3 === 0
      ? `<rect x="8" y="8" width="64" height="64" rx="16" fill="${accent}"/>`
      : variant % 3 === 1
        ? `<circle cx="40" cy="40" r="32" fill="${accent}"/>`
        : `<path d="M40 8 L72 40 L40 72 L8 40 Z" fill="${accent}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 80" width="260" height="80" role="img" aria-label="${safeName}">
  ${shape}
  <text x="40" y="40" text-anchor="middle" dominant-baseline="central" font-family="IBM Plex Sans Arabic, sans-serif" font-size="28" font-weight="700" fill="${dark}">${safeInitials}</text>
  <text x="88" y="40" dominant-baseline="central" font-family="IBM Plex Sans Arabic, sans-serif" font-size="22" font-weight="600" fill="${accent}">${safeName}</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Usage reporting
// ---------------------------------------------------------------------------

export async function listGenerations(context: StoreContext, limit = 50) {
  assertPermission(context, 'ai.use');

  return prisma.aiGeneration.findMany({
    where: { storeId: context.storeId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      kind: true,
      provider: true,
      model: true,
      status: true,
      creditsUsed: true,
      costMicros: true,
      inputTokens: true,
      outputTokens: true,
      createdAt: true,
      errorMessage: true,
    },
  });
}
