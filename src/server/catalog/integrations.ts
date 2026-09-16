/**
 * Integration catalogue.
 *
 * Providers are data. Each one declares the credential fields it needs and
 * what it can do, so the settings UI is generated rather than hand-written per
 * provider, and adding one is a catalogue entry plus a driver.
 *
 * Credential fields are declared `secret` when their value must never come
 * back to the browser after it is saved — the service returns a mask instead.
 */

export interface CredentialField {
  key: string;
  labelAr: string;
  labelEn: string;
  /** Secret values are write-only: stored encrypted, never returned raw. */
  secret: boolean;
  required: boolean;
  placeholder?: string;
  helpAr?: string;
}

export type IntegrationCapability = 'import_orders' | 'import_products' | 'export_orders' | 'sync_status';

export interface IntegrationProvider {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  category: 'sheets' | 'commerce' | 'messaging';
  icon: string;
  capabilities: readonly IntegrationCapability[];
  credentialFields: readonly CredentialField[];
  /** Platform fields an import can map onto, for the column mapper. */
  importFields: readonly string[];
  /** REBUILD PROPOSAL: not observed in the reference, inferred from the brief. */
  proposal: boolean;
}

const ORDER_IMPORT_FIELDS = [
  'customerName',
  'customerPhone',
  'state',
  'city',
  'address',
  'productName',
  'quantity',
  'price',
  'notes',
] as const;

const PRODUCT_IMPORT_FIELDS = [
  'name',
  'sku',
  'price',
  'compareAtPrice',
  'stock',
  'category',
  'description',
  'imageUrl',
] as const;

export const INTEGRATION_PROVIDERS: readonly IntegrationProvider[] = [
  {
    key: 'google_sheets',
    nameAr: 'جداول جوجل',
    nameEn: 'Google Sheets',
    descriptionAr:
      'استيراد الطلبات أو المنتجات من جدول بيانات، مع ربط أعمدة الجدول بحقول المنصة.',
    category: 'sheets',
    icon: 'sheet',
    capabilities: ['import_orders', 'import_products', 'export_orders'],
    credentialFields: [
      {
        key: 'serviceAccountEmail',
        labelAr: 'بريد حساب الخدمة',
        labelEn: 'Service account email',
        secret: false,
        required: true,
        placeholder: 'name@project.iam.gserviceaccount.com',
        helpAr: 'شارك الجدول مع هذا البريد بصلاحية الاطلاع.',
      },
      {
        key: 'privateKey',
        labelAr: 'المفتاح الخاص',
        labelEn: 'Private key',
        secret: true,
        required: true,
        helpAr: 'يُخزَّن مشفراً ولا يمكن عرضه مرة أخرى بعد الحفظ.',
      },
      {
        key: 'spreadsheetId',
        labelAr: 'معرّف الجدول',
        labelEn: 'Spreadsheet ID',
        secret: false,
        required: true,
        helpAr: 'الجزء بين /d/ و /edit في رابط الجدول.',
      },
    ],
    importFields: [...ORDER_IMPORT_FIELDS, ...PRODUCT_IMPORT_FIELDS],
    proposal: false,
  },
  {
    key: 'csv',
    nameAr: 'ملف CSV',
    nameEn: 'CSV file',
    descriptionAr: 'رفع ملف CSV لاستيراد المنتجات أو الطلبات دفعة واحدة.',
    category: 'sheets',
    icon: 'file-spreadsheet',
    capabilities: ['import_orders', 'import_products'],
    credentialFields: [],
    importFields: [...ORDER_IMPORT_FIELDS, ...PRODUCT_IMPORT_FIELDS],
    proposal: false,
  },
  {
    key: 'shopify',
    nameAr: 'Shopify',
    nameEn: 'Shopify',
    descriptionAr: 'استيراد المنتجات والطلبات من متجر Shopify قائم.',
    category: 'commerce',
    icon: 'store',
    capabilities: ['import_products', 'import_orders'],
    credentialFields: [
      {
        key: 'shopDomain',
        labelAr: 'نطاق المتجر',
        labelEn: 'Shop domain',
        secret: false,
        required: true,
        placeholder: 'my-shop.myshopify.com',
      },
      {
        key: 'adminAccessToken',
        labelAr: 'رمز الوصول الإداري',
        labelEn: 'Admin access token',
        secret: true,
        required: true,
      },
    ],
    importFields: PRODUCT_IMPORT_FIELDS,
    proposal: true,
  },
  {
    key: 'woocommerce',
    nameAr: 'WooCommerce',
    nameEn: 'WooCommerce',
    descriptionAr: 'استيراد المنتجات والطلبات من متجر WooCommerce.',
    category: 'commerce',
    icon: 'store',
    capabilities: ['import_products', 'import_orders'],
    credentialFields: [
      { key: 'siteUrl', labelAr: 'رابط الموقع', labelEn: 'Site URL', secret: false, required: true },
      { key: 'consumerKey', labelAr: 'Consumer key', labelEn: 'Consumer key', secret: false, required: true },
      { key: 'consumerSecret', labelAr: 'Consumer secret', labelEn: 'Consumer secret', secret: true, required: true },
    ],
    importFields: PRODUCT_IMPORT_FIELDS,
    proposal: true,
  },
  {
    key: 'webhook',
    nameAr: 'Webhook خارجي',
    nameEn: 'Outbound webhook',
    descriptionAr: 'إرسال إشعار إلى نظامك عند تغيّر حالة الطلب.',
    category: 'messaging',
    icon: 'webhook',
    capabilities: ['sync_status'],
    credentialFields: [
      { key: 'url', labelAr: 'الرابط', labelEn: 'URL', secret: false, required: true, placeholder: 'https://' },
      { key: 'signingSecret', labelAr: 'مفتاح التوقيع', labelEn: 'Signing secret', secret: true, required: false },
    ],
    importFields: [],
    proposal: true,
  },
];

export function getIntegrationProvider(key: string): IntegrationProvider | null {
  return INTEGRATION_PROVIDERS.find((provider) => provider.key === key) ?? null;
}

export const IMPORT_TARGETS = ['products', 'orders'] as const;
export type ImportTarget = (typeof IMPORT_TARGETS)[number];

export function importFieldsFor(target: ImportTarget): readonly string[] {
  return target === 'products' ? PRODUCT_IMPORT_FIELDS : ORDER_IMPORT_FIELDS;
}

/** Fields an import cannot complete without. */
export function requiredImportFieldsFor(target: ImportTarget): readonly string[] {
  return target === 'products' ? ['name', 'price'] : ['customerPhone', 'productName'];
}
