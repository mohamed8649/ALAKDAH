import { z } from 'zod';

import { moneyField } from './product';

export const shippingZoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'validation.required').max(120),
  price: moneyField(),
  regions: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
  cities: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
});

export const shippingMethodSchema = z.object({
  name: z.string().trim().min(2, 'validation.required').max(120),
  nameEn: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(400).optional().or(z.literal('')),
  type: z.enum(['DELIVERY', 'PICKUP', 'EXPRESS']).default('DELIVERY'),
  price: moneyField(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  supportsCod: z.boolean().default(true),
  minDeliveryDays: z.coerce.number().int().min(0).max(90).nullable().optional(),
  maxDeliveryDays: z.coerce.number().int().min(0).max(90).nullable().optional(),
  zones: z.array(shippingZoneSchema).max(50).default([]),
});

export type ShippingMethodInput = z.infer<typeof shippingMethodSchema>;

export const shippingRuleSchema = z
  .object({
    name: z.string().trim().min(2, 'validation.required').max(120),
    priority: z.coerce.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
    matchState: z.string().trim().max(80).optional().or(z.literal('')),
    matchCity: z.string().trim().max(80).optional().or(z.literal('')),
    matchMinTotal: moneyField({ optional: true }).optional(),
    matchMaxTotal: moneyField({ optional: true }).optional(),
    matchMethodType: z.enum(['DELIVERY', 'PICKUP', 'EXPRESS']).optional().or(z.literal('')),
    providerId: z.string().min(1, 'validation.required'),
  })
  .superRefine((value, ctx) => {
    if (
      value.matchMinTotal != null &&
      value.matchMaxTotal != null &&
      value.matchMinTotal > value.matchMaxTotal
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matchMaxTotal'],
        message: 'validation.maxBelowMin',
      });
    }
  });

export type ShippingRuleInput = z.infer<typeof shippingRuleSchema>;

export const shippingProviderSchema = z.object({
  providerKey: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2, 'validation.required').max(120),
  apiKey: z.string().trim().max(400).optional().or(z.literal('')),
  apiSecret: z.string().trim().max(400).optional().or(z.literal('')),
  accountId: z.string().trim().max(120).optional().or(z.literal('')),
  baseUrl: z.string().trim().max(300).optional().or(z.literal('')),
});

export type ShippingProviderInput = z.infer<typeof shippingProviderSchema>;

export const deliverySlipSchema = z.object({
  showCodAmount: z.boolean().default(true),
  showCustomerName: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  showAddress: z.boolean().default(true),
  showProducts: z.boolean().default(true),
  showQuantities: z.boolean().default(true),
  showNotes: z.boolean().default(true),
  showLogo: z.boolean().default(true),
  showStoreInfo: z.boolean().default(true),
  showSignatureLines: z.boolean().default(false),
  showOrderNumber: z.boolean().default(true),
  showBarcode: z.boolean().default(false),
  language: z.enum(['ar', 'en']).default('ar'),
  paperSize: z.enum(['A4', 'A5', 'A6']).default('A5'),
  footerNote: z.string().trim().max(300).optional().or(z.literal('')),
});

export type DeliverySlipInput = z.infer<typeof deliverySlipSchema>;
