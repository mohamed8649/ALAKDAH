/**
 * Plan catalogue.
 *
 * Prices are data, seeded into the database — no price string is hard-coded in
 * a component. Limits use -1 for unlimited. Money is in minor units of the
 * plan's currency (LYD, three minor digits).
 */

export interface PlanSeed {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  isPayg: boolean;
  position: number;
  features: readonly string[];
  limits: Readonly<Record<string, number>>;
}

export const PLANS: readonly PlanSeed[] = [
  {
    key: 'payg',
    nameAr: 'الدفع حسب الاستخدام',
    nameEn: 'Pay as you go',
    descriptionAr: 'ابدأ بدون اشتراك شهري. مناسب لأول متجر.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'LYD',
    isPayg: true,
    position: 0,
    features: ['landing_pages'],
    limits: {
      orders: 50,
      products: 20,
      agents: 1,
      landing_pages: 1,
      ai_credits: 5,
      abandoned_recovery: 0,
      staff: 1,
      pixels: 1,
      integrations: 0,
    },
  },
  {
    key: 'starter',
    nameAr: 'المبتدئ',
    nameEn: 'Starter',
    descriptionAr: 'لمتجر بدأ يستقبل طلبات منتظمة.',
    monthlyPrice: 99_000,
    yearlyPrice: 990_000,
    currency: 'LYD',
    isPayg: false,
    position: 1,
    features: ['pixels', 'landing_pages', 'call_center', 'themes', 'ai_tools'],
    limits: {
      orders: 500,
      products: 200,
      agents: 3,
      landing_pages: 10,
      ai_credits: 50,
      abandoned_recovery: 0,
      staff: 3,
      pixels: 3,
      integrations: 1,
    },
  },
  {
    key: 'growth',
    nameAr: 'النمو',
    nameEn: 'Growth',
    descriptionAr: 'لمتجر يعتمد على الإعلانات ومركز اتصال.',
    monthlyPrice: 249_000,
    yearlyPrice: 2_490_000,
    currency: 'LYD',
    isPayg: false,
    position: 2,
    features: [
      'pixels',
      'integrations',
      'abandoned_recovery',
      'ai_tools',
      'landing_pages',
      'call_center',
      'themes',
      'custom_domain',
    ],
    limits: {
      orders: 3000,
      products: 1000,
      agents: 10,
      landing_pages: 50,
      ai_credits: 300,
      abandoned_recovery: 500,
      staff: 10,
      pixels: 10,
      integrations: 5,
    },
  },
  {
    key: 'pro',
    nameAr: 'الاحترافي',
    nameEn: 'Pro',
    descriptionAr: 'بدون حدود عملية، مع الوصول البرمجي.',
    monthlyPrice: 599_000,
    yearlyPrice: 5_990_000,
    currency: 'LYD',
    isPayg: false,
    position: 3,
    features: [
      'pixels',
      'integrations',
      'abandoned_recovery',
      'ai_tools',
      'landing_pages',
      'call_center',
      'themes',
      'custom_domain',
      'api_access',
    ],
    limits: {
      orders: -1,
      products: -1,
      agents: -1,
      landing_pages: -1,
      ai_credits: 2000,
      abandoned_recovery: -1,
      staff: -1,
      pixels: -1,
      integrations: -1,
    },
  },
] as const;

export interface AddOnSeed {
  key: string;
  nameAr: string;
  nameEn: string;
  limitKey: string;
  quantity: number;
  price: number;
  currency: string;
}

export const ADD_ONS: readonly AddOnSeed[] = [
  {
    key: 'orders_500',
    nameAr: '٥٠٠ طلب إضافي',
    nameEn: '500 extra orders',
    limitKey: 'orders',
    quantity: 500,
    price: 49_000,
    currency: 'LYD',
  },
  {
    key: 'orders_2000',
    nameAr: '٢٠٠٠ طلب إضافي',
    nameEn: '2000 extra orders',
    limitKey: 'orders',
    quantity: 2000,
    price: 149_000,
    currency: 'LYD',
  },
  {
    key: 'abandoned_500',
    nameAr: '٥٠٠ استرجاع سلة',
    nameEn: '500 abandoned recoveries',
    limitKey: 'abandoned_recovery',
    quantity: 500,
    price: 59_000,
    currency: 'LYD',
  },
  {
    key: 'ai_credits_200',
    nameAr: '٢٠٠ رصيد ذكاء اصطناعي',
    nameEn: '200 AI credits',
    limitKey: 'ai_credits',
    quantity: 200,
    price: 39_000,
    currency: 'LYD',
  },
] as const;
