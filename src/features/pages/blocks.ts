import { z } from 'zod';

/**
 * Page document model.
 *
 * A page is data, never code: `{ version, blocks: [{ id, type, props }] }`.
 * No JSX, no HTML and no JavaScript is ever stored or evaluated — each block
 * type has a schema, and the renderer maps a known type to a known component.
 * That is what makes the builder safe to expose to merchants.
 */

export const BLOCK_TYPES = [
  'hero',
  'product',
  'image',
  'text',
  'features',
  'trust',
  'testimonials',
  'offer',
  'countdown',
  'faq',
  'cta',
  'productGrid',
  'orderForm',
  'spacer',
  'video',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

const textAlign = z.enum(['start', 'center', 'end']).default('start');

/** Per-type prop schemas. Unknown props are stripped, not stored. */
export const BLOCK_SCHEMAS = {
  hero: z.object({
    headline: z.string().max(200).default(''),
    subheadline: z.string().max(600).default(''),
    imageUrl: z.string().max(500).nullable().default(null),
    ctaText: z.string().max(60).default(''),
    align: z.enum(['start', 'center']).default('center'),
  }),
  product: z.object({
    productId: z.string().max(60).nullable().default(null),
    showPrice: z.boolean().default(true),
  }),
  image: z.object({
    url: z.string().max(500).nullable().default(null),
    alt: z.string().max(200).default(''),
  }),
  text: z.object({
    content: z.string().max(5000).default(''),
    align: textAlign,
  }),
  features: z.object({
    title: z.string().max(200).default(''),
    items: z
      .array(z.object({ title: z.string().max(160), description: z.string().max(400).default('') }))
      .max(12)
      .default([]),
  }),
  trust: z.object({
    useStoreBadges: z.boolean().default(true),
  }),
  testimonials: z.object({
    title: z.string().max(200).default(''),
    items: z
      .array(z.object({ name: z.string().max(120), quote: z.string().max(600) }))
      .max(12)
      .default([]),
  }),
  offer: z.object({
    title: z.string().max(200).default(''),
    description: z.string().max(600).default(''),
  }),
  countdown: z.object({
    title: z.string().max(200).default(''),
    /** ISO instant. Evaluated client-side for display only — it never gates a price. */
    endsAt: z.string().max(40).nullable().default(null),
  }),
  faq: z.object({
    title: z.string().max(200).default(''),
    items: z
      .array(z.object({ question: z.string().max(300), answer: z.string().max(1500) }))
      .max(20)
      .default([]),
  }),
  cta: z.object({
    headline: z.string().max(200).default(''),
    text: z.string().max(60).default(''),
  }),
  productGrid: z.object({
    limit: z.coerce.number().int().min(2).max(24).default(8),
    collectionHandle: z.string().max(80).nullable().default(null),
  }),
  orderForm: z.object({
    productId: z.string().max(60).nullable().default(null),
    title: z.string().max(200).default(''),
  }),
  spacer: z.object({
    size: z.enum(['sm', 'md', 'lg']).default('md'),
  }),
  video: z.object({
    // Only a YouTube or Vimeo id, never a raw embed string — an arbitrary
    // iframe would be an injection point.
    provider: z.enum(['youtube', 'vimeo']).default('youtube'),
    videoId: z.string().max(60).default(''),
  }),
} as const satisfies Record<BlockType, z.ZodTypeAny>;

export const blockSchema = z.object({
  id: z.string().min(1).max(60),
  type: z.enum(BLOCK_TYPES),
  props: z.record(z.unknown()).default({}),
});

export const pageDocumentSchema = z.object({
  version: z.literal(1).default(1),
  blocks: z.array(blockSchema).max(60).default([]),
});

export type PageBlock = z.infer<typeof blockSchema>;
export type PageDocument = z.infer<typeof pageDocumentSchema>;

/**
 * Validate and normalise a document.
 *
 * Each block's props are parsed against its own schema, so a block that arrives
 * with unexpected keys is normalised rather than stored verbatim. Blocks whose
 * type is unknown are dropped.
 */
export function normaliseDocument(input: unknown): PageDocument {
  const parsed = pageDocumentSchema.safeParse(input);
  if (!parsed.success) return { version: 1, blocks: [] };

  const blocks: PageBlock[] = [];

  for (const block of parsed.data.blocks) {
    const schema = BLOCK_SCHEMAS[block.type];
    if (!schema) continue;

    const props = schema.safeParse(block.props);
    blocks.push({
      id: block.id,
      type: block.type,
      props: (props.success ? props.data : schema.parse({})) as Record<string, unknown>,
    });
  }

  return { version: 1, blocks };
}

export function defaultProps(type: BlockType): Record<string, unknown> {
  return BLOCK_SCHEMAS[type].parse({}) as Record<string, unknown>;
}

export function createBlock(type: BlockType): PageBlock {
  return {
    id: `blk_${Math.random().toString(36).slice(2, 10)}`,
    type,
    props: defaultProps(type),
  };
}

/** Block types a merchant can insert from the builder palette. */
export const PALETTE: readonly BlockType[] = [
  'hero',
  'text',
  'image',
  'features',
  'product',
  'productGrid',
  'trust',
  'testimonials',
  'offer',
  'countdown',
  'faq',
  'cta',
  'orderForm',
  'video',
  'spacer',
];

export const BLOCK_ICONS: Record<BlockType, string> = {
  hero: 'layout-template',
  product: 'package',
  image: 'package',
  text: 'file-text',
  features: 'check',
  trust: 'shield-check',
  testimonials: 'message-circle',
  offer: 'percent',
  countdown: 'clock',
  faq: 'file-text',
  cta: 'zap',
  productGrid: 'layers',
  orderForm: 'shopping-cart',
  spacer: 'layers',
  video: 'activity',
};
