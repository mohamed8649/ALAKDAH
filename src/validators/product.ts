import { z } from 'zod';

import { parseMoney } from '@/lib/money';
import { isValidSlug } from '@/lib/slug';

/**
 * Product validation contracts.
 *
 * The same schemas run in the browser (react-hook-form resolver) and on the
 * server (before any write). Client validation is a convenience; the server
 * copy is the one that protects the database.
 */

/** Accepts a decimal string from a form and returns minor units. */
export const moneyField = (options?: { optional?: boolean }) =>
  z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const raw = typeof value === 'number' ? value : value.trim();
      if (raw === '' || raw === null) {
        if (options?.optional) return null;
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.required' });
        return z.NEVER;
      }

      const minor = parseMoney(raw);
      if (minor === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.invalidNumber' });
        return z.NEVER;
      }
      return minor;
    })
    .nullable();

export const slugField = z
  .string()
  .trim()
  .max(80)
  .refine((value) => value === '' || isValidSlug(value), { message: 'validation.invalidSlug' });

export const productOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'validation.required').max(60),
  position: z.number().int().min(0).default(0),
  values: z
    .array(
      z.object({
        id: z.string().optional(),
        value: z.string().trim().min(1).max(60),
        position: z.number().int().min(0).default(0),
      }),
    )
    .min(1, 'validation.selectAtLeastOne')
    .max(50),
});

export const productVariantSchema = z.object({
  id: z.string().optional(),
  signature: z.string(),
  title: z.string(),
  sku: z.string().trim().max(60).nullable().optional(),
  barcode: z.string().trim().max(60).nullable().optional(),
  price: moneyField({ optional: true }).optional(),
  compareAtPrice: moneyField({ optional: true }).optional(),
  cost: moneyField({ optional: true }).optional(),
  stockQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  imageId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  optionValueIds: z.array(z.string()).default([]),
});

export const productImageSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1).max(500),
  altText: z.string().max(200).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
});

export const productOfferSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['QUANTITY_DISCOUNT', 'BUNDLE_PRICE', 'FREE_SHIPPING']).default('QUANTITY_DISCOUNT'),
  title: z.string().trim().min(1).max(120),
  minQuantity: z.coerce.number().int().min(1).max(100).default(2),
  discountPercent: z.coerce.number().int().min(0).max(100).nullable().optional(),
  fixedPrice: moneyField({ optional: true }).optional(),
  isActive: z.boolean().default(true),
});

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, 'validation.required').max(200),
    nameEn: z.string().trim().max(200).nullable().optional(),
    slug: slugField.optional(),
    sku: z.string().trim().max(60).nullable().optional(),
    description: z.string().max(20_000).nullable().optional(),
    shortDescription: z.string().max(500).nullable().optional(),

    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
    visibility: z.enum(['VISIBLE', 'HIDDEN']).default('VISIBLE'),

    price: moneyField(),
    compareAtPrice: moneyField({ optional: true }).optional(),
    cost: moneyField({ optional: true }).optional(),

    trackInventory: z.boolean().default(true),
    stockQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
    allowBackorder: z.boolean().default(false),

    weightGrams: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
    shippingRequired: z.boolean().default(true),
    freeShipping: z.boolean().default(false),

    upsellEnabled: z.boolean().default(false),
    upsellTitle: z.string().max(200).nullable().optional(),
    upsellDescription: z.string().max(1000).nullable().optional(),

    seoTitle: z.string().max(200).nullable().optional(),
    seoDescription: z.string().max(400).nullable().optional(),

    tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
    categoryIds: z.array(z.string()).max(30).default([]),
    collectionIds: z.array(z.string()).max(30).default([]),
    relatedProductIds: z.array(z.string()).max(20).default([]),

    images: z.array(productImageSchema).max(20).default([]),
    options: z.array(productOptionSchema).max(3).default([]),
    variants: z.array(productVariantSchema).max(200).default([]),
    offers: z.array(productOfferSchema).max(10).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.compareAtPrice !== null && value.compareAtPrice !== undefined && value.price !== null) {
      if (value.compareAtPrice <= value.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compareAtPrice'],
          message: 'validation.compareAtTooLow',
        });
      }
    }

    // Option names must be unique, otherwise the variant signature becomes
    // ambiguous and the generator can produce two identically titled rows.
    const names = value.options.map((option) => option.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'validation.duplicateOption' });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export const productFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  categoryId: z.string().optional(),
  collectionId: z.string().optional(),
  stock: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(25),
});

export type ProductFilter = z.infer<typeof productFilterSchema>;

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  newQuantity: z.coerce.number().int().min(0).max(1_000_000),
  reason: z
    .enum(['MANUAL_ADJUSTMENT', 'RESTOCK', 'CORRECTION'])
    .default('MANUAL_ADJUSTMENT'),
  note: z.string().max(300).nullable().optional(),
});

export type InventoryAdjustment = z.infer<typeof inventoryAdjustmentSchema>;
