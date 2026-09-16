/**
 * Slug generation.
 *
 * Arabic product names must produce usable URLs. Transliteration keeps the slug
 * readable and ASCII-safe; when a name transliterates to nothing usable we fall
 * back to a short random suffix rather than emitting an empty slug.
 */

const ARABIC_MAP: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh',
  د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z',
  ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w',
  ي: 'y', ى: 'a', ة: 'h', ء: '', ئ: 'y', ؤ: 'w', لا: 'la',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function slugify(input: string, fallbackPrefix = 'item'): string {
  const transliterated = Array.from(input.trim())
    .map((char) => ARABIC_MAP[char] ?? char)
    .join('');

  const slug = transliterated
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

  if (slug) return slug;
  return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}

/**
 * Append -2, -3 … until the slug is free. `taken` is the set of existing slugs
 * for the tenant; the caller is responsible for querying it inside the same
 * transaction that inserts.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

/**
 * Human-readable order number, e.g. "A7K3M2".
 * Ambiguous characters (0/O, 1/I) are excluded so a number read over the phone
 * is not mistyped, and the value is random rather than sequential so order
 * numbers cannot be enumerated from the tracking page.
 */
const ORDER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateOrderNumber(length = 6): string {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += ORDER_ALPHABET[Math.floor(Math.random() * ORDER_ALPHABET.length)];
  }
  return result;
}

export function normaliseFieldKey(label: string): string {
  const slug = slugify(label, 'field').replace(/-/g, '_');
  return slug.slice(0, 40);
}

/** Strip path traversal and unsafe characters from an uploaded filename. */
export function safeFilename(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? 'file';
  const dotIndex = base.lastIndexOf('.');
  const name = dotIndex > 0 ? base.slice(0, dotIndex) : base;
  const extension = dotIndex > 0 ? base.slice(dotIndex + 1).toLowerCase() : '';
  const safeName = slugify(name, 'file').slice(0, 48);
  const safeExtension = extension.replace(/[^a-z0-9]/g, '').slice(0, 5);
  return safeExtension ? `${safeName}.${safeExtension}` : safeName;
}
