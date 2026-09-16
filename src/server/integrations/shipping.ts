import 'server-only';

/**
 * Carrier provider registry.
 *
 * Provider-specific behaviour stays inside a definition object. Nothing else in
 * the codebase branches on `providerKey === 'x'`; adding a carrier means adding
 * one entry here.
 *
 * REBUILD PROPOSAL — the reference recordings show a carrier list with connect
 * and test-connection controls, but not the wire protocol of any specific
 * carrier. These definitions describe the credential shape and validation
 * contract; `validate` performs a real HTTP reachability check where a base URL
 * is configured and otherwise reports what is missing, rather than pretending a
 * connection succeeded.
 */

export interface ProviderCredentialField {
  key: 'apiKey' | 'apiSecret' | 'accountId' | 'baseUrl';
  labelAr: string;
  secret: boolean;
  required: boolean;
}

export interface ValidationResult {
  ok: boolean;
  message: string;
}

export interface ShippingProviderDefinition {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  logo: string;
  credentialFields: readonly ProviderCredentialField[];
  validate(credentials: Record<string, string>): Promise<ValidationResult>;
}

const API_KEY_FIELD: ProviderCredentialField = {
  key: 'apiKey',
  labelAr: 'مفتاح API',
  secret: true,
  required: true,
};

const API_SECRET_FIELD: ProviderCredentialField = {
  key: 'apiSecret',
  labelAr: 'المفتاح السري',
  secret: true,
  required: false,
};

const ACCOUNT_FIELD: ProviderCredentialField = {
  key: 'accountId',
  labelAr: 'معرّف الحساب',
  secret: false,
  required: false,
};

const BASE_URL_FIELD: ProviderCredentialField = {
  key: 'baseUrl',
  labelAr: 'رابط الخدمة',
  secret: false,
  required: false,
};

/**
 * Default validation: check the required credentials are present, then, when a
 * base URL is configured, confirm the endpoint is reachable. Reporting "cannot
 * verify" is more useful to a merchant than a green tick that means nothing.
 */
function defaultValidate(fields: readonly ProviderCredentialField[]) {
  return async (credentials: Record<string, string>): Promise<ValidationResult> => {
    const missing = fields
      .filter((field) => field.required && !credentials[field.key])
      .map((field) => field.labelAr);

    if (missing.length > 0) {
      return { ok: false, message: `بيانات ناقصة: ${missing.join('، ')}` };
    }

    const baseUrl = credentials.baseUrl;
    if (!baseUrl) {
      return {
        ok: true,
        message: 'تم حفظ بيانات الاعتماد. لم يُحدد رابط خدمة للتحقق منه.',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${credentials.apiKey ?? ''}` },
      });
      clearTimeout(timeout);

      if (response.ok || response.status === 401 || response.status === 403) {
        return { ok: response.ok, message: response.ok ? 'الاتصال ناجح.' : 'الخدمة رفضت بيانات الاعتماد.' };
      }
      return { ok: false, message: `الخدمة ردّت برمز ${response.status}.` };
    } catch {
      return { ok: false, message: 'تعذّر الوصول إلى رابط الخدمة.' };
    }
  };
}

const DEFINITIONS: ShippingProviderDefinition[] = [
  {
    key: 'manual',
    nameAr: 'توصيل ذاتي',
    nameEn: 'In-house delivery',
    descriptionAr: 'مندوبوك أو توصيلك الخاص بدون ربط خارجي.',
    logo: 'truck',
    credentialFields: [],
    validate: async () => ({ ok: true, message: 'التوصيل الذاتي لا يحتاج ربطاً.' }),
  },
  {
    key: 'generic_rest',
    nameAr: 'شركة توصيل (REST)',
    nameEn: 'Generic REST carrier',
    descriptionAr: 'اربط أي شركة توصيل توفّر واجهة REST عبر مفتاح API ورابط خدمة.',
    logo: 'plug',
    credentialFields: [API_KEY_FIELD, API_SECRET_FIELD, ACCOUNT_FIELD, { ...BASE_URL_FIELD, required: true }],
    validate: defaultValidate([API_KEY_FIELD, { ...BASE_URL_FIELD, required: true }]),
  },
  {
    key: 'libya_post',
    nameAr: 'البريد الليبي',
    nameEn: 'Libya Post',
    descriptionAr: 'خدمة البريد الوطنية.',
    logo: 'package',
    credentialFields: [API_KEY_FIELD, ACCOUNT_FIELD, BASE_URL_FIELD],
    validate: defaultValidate([API_KEY_FIELD]),
  },
  {
    key: 'tripoli_express',
    nameAr: 'طرابلس إكسبرس',
    nameEn: 'Tripoli Express',
    descriptionAr: 'توصيل سريع داخل طرابلس وضواحيها.',
    logo: 'zap',
    credentialFields: [API_KEY_FIELD, ACCOUNT_FIELD, BASE_URL_FIELD],
    validate: defaultValidate([API_KEY_FIELD]),
  },
  {
    key: 'benghazi_delivery',
    nameAr: 'بنغازي للتوصيل',
    nameEn: 'Benghazi Delivery',
    descriptionAr: 'تغطية المنطقة الشرقية.',
    logo: 'map-pin',
    credentialFields: [API_KEY_FIELD, ACCOUNT_FIELD, BASE_URL_FIELD],
    validate: defaultValidate([API_KEY_FIELD]),
  },
];

export function listProviderDefinitions(): readonly ShippingProviderDefinition[] {
  return DEFINITIONS;
}

export function getProvider(key: string): ShippingProviderDefinition | null {
  return DEFINITIONS.find((definition) => definition.key === key) ?? null;
}
