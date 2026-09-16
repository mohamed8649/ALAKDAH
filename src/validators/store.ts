import { z } from 'zod';

import { CHECKOUT_FIELD_KEYS } from '@/server/services/store-service';

export const storeIdentitySchema = z.object({
  name: z.string().trim().min(2, 'validation.required').max(120),
  description: z.string().trim().max(600).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email('validation.invalidEmail').max(200).optional().or(z.literal('')),
  logoUrl: z.string().trim().max(500).optional().or(z.literal('')),
  faviconUrl: z.string().trim().max(500).optional().or(z.literal('')),
  instagram: z.string().trim().max(200).optional().or(z.literal('')),
  facebook: z.string().trim().max(200).optional().or(z.literal('')),
  tiktok: z.string().trim().max(200).optional().or(z.literal('')),
  telegram: z.string().trim().max(200).optional().or(z.literal('')),
  whatsapp: z.string().trim().max(30).optional().or(z.literal('')),
  defaultLocale: z.enum(['ar', 'en']).default('ar'),
  currency: z.enum(['LYD', 'USD', 'EUR', 'TND', 'EGP']).default('LYD'),
  timezone: z.string().trim().min(3).max(60).default('Africa/Tripoli'),
});

export type StoreIdentityInput = z.infer<typeof storeIdentitySchema>;

export const checkoutFieldsSchema = z.object({
  fields: z
    .array(
      z.object({
        fieldKey: z.enum(CHECKOUT_FIELD_KEYS),
        mode: z.enum(['REQUIRED', 'OPTIONAL', 'HIDDEN']),
      }),
    )
    .min(1),
});

export type CheckoutFieldsInput = z.infer<typeof checkoutFieldsSchema>;

export const customFieldSchema = z
  .object({
    label: z.string().trim().min(1, 'validation.required').max(120),
    fieldKey: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-z][a-z0-9_]*$/, 'validation.invalidSlug'),
    type: z.enum(['TEXT', 'TEXTAREA', 'SELECT', 'RADIO', 'CHECKBOX', 'NUMBER']).default('TEXT'),
    placeholder: z.string().trim().max(160).optional().or(z.literal('')),
    helpText: z.string().trim().max(240).optional().or(z.literal('')),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    isActive: z.boolean().default(true),
    position: z.coerce.number().int().min(0).max(100).default(0),
  })
  .superRefine((value, ctx) => {
    if (['SELECT', 'RADIO'].includes(value.type) && value.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'validation.selectAtLeastOne',
      });
    }
  });

export type CustomFieldInput = z.infer<typeof customFieldSchema>;

export const storeSecuritySchema = z.object({
  fraudProtectionEnabled: z.boolean().default(false),
  fraudMaxOrders: z.coerce.number().int().min(1).max(50).default(3),
  fraudWindowHours: z.coerce.number().int().min(1).max(720).default(24),
  fraudAction: z.enum(['BLOCK', 'FLAG', 'ALLOW']).default('FLAG'),
  abandonedTrackingEnabled: z.boolean().default(false),
});

export type StoreSecurityInput = z.infer<typeof storeSecuritySchema>;

export const storeNotificationSchema = z.object({
  notificationsEnabled: z.boolean().default(true),
  notificationSound: z.boolean().default(true),
  notificationVolume: z.coerce.number().int().min(0).max(100).default(70),
  notifyOnNewOrder: z.boolean().default(true),
  notifyOnConfirmed: z.boolean().default(false),
  notifyOnShipped: z.boolean().default(false),
});

export type StoreNotificationInput = z.infer<typeof storeNotificationSchema>;

export const checkoutSettingsSchema = z.object({
  cartEnabled: z.boolean().default(true),
  thankYouEnabled: z.boolean().default(true),
  thankYouTitle: z.string().trim().min(1).max(160),
  thankYouMessage: z.string().trim().max(400),
  thankYouButtonText: z.string().trim().max(60),
  thankYouButtonUrl: z.string().trim().max(400).optional().or(z.literal('')),
  quickContactPhoneEnabled: z.boolean().default(false),
  quickContactPhone: z.string().trim().max(30).optional().or(z.literal('')),
  quickContactWhatsappEnabled: z.boolean().default(false),
  quickContactWhatsapp: z.string().trim().max(30).optional().or(z.literal('')),
  quickContactCountryCode: z.string().trim().max(6).default('+218'),
  trackingEnabled: z.boolean().default(true),
  trackingMethod: z
    .enum(['ORDER_NUMBER_AND_PHONE', 'PHONE_ONLY', 'ORDER_NUMBER_ONLY'])
    .default('ORDER_NUMBER_AND_PHONE'),
});

export type CheckoutSettingsInput = z.infer<typeof checkoutSettingsSchema>;

export const designSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'validation.invalidColor'),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'validation.invalidColor'),
  fontFamily: z.enum(['ibm-plex-arabic', 'noto-sans-arabic', 'tajawal', 'alexandria']),
  logoUrl: z.string().trim().max(500).optional().or(z.literal('')),
  faviconUrl: z.string().trim().max(500).optional().or(z.literal('')),
  announcementEnabled: z.boolean().default(false),
  announcementText: z.string().trim().max(200).optional().or(z.literal('')),
});

export type DesignInput = z.infer<typeof designSchema>;

export const accessTokenSchema = z.object({
  name: z.string().trim().min(2, 'validation.required').max(80),
  scopes: z.array(z.string().min(1)).min(1, 'validation.selectAtLeastOne').max(40),
  expiresInDays: z.coerce.number().int().min(0).max(3650).default(0),
});

export type AccessTokenInput = z.infer<typeof accessTokenSchema>;
