import { toDecimalString } from '@/lib/money';
import type { ProductDetail } from '@/server/services/product-service';

import type { ProductEditorInitial } from './product-editor';

/**
 * Map a stored product into the editor's string-based form state.
 *
 * Money crosses this boundary as a decimal string ("235.000") because that is
 * what a merchant types; it is converted back to minor units by the validator
 * on submit. Doing the conversion here, in one place, is what stops a float
 * from ever reaching the database.
 */

export function emptyProduct(currency: string): ProductEditorInitial {
  return {
    id: null,
    name: '',
    nameEn: '',
    slug: '',
    sku: '',
    description: '',
    shortDescription: '',
    status: 'DRAFT',
    visibility: 'VISIBLE',
    price: '',
    compareAtPrice: '',
    cost: '',
    trackInventory: true,
    stockQuantity: '0',
    lowStockThreshold: '5',
    allowBackorder: false,
    weightGrams: '',
    shippingRequired: true,
    freeShipping: false,
    seoTitle: '',
    seoDescription: '',
    tags: [],
    images: [],
    options: [],
    variants: [],
    related: [],
    // `currency` is accepted so callers cannot forget it once per-store
    // currencies drive the money placeholders.
    ...(currency ? {} : {}),
  };
}

export function toEditorState(product: ProductDetail, currency: string): ProductEditorInitial {
  return {
    id: product.id,
    name: product.name,
    nameEn: product.nameEn ?? '',
    slug: product.slug,
    sku: product.sku ?? '',
    description: product.description ?? '',
    shortDescription: product.shortDescription ?? '',
    status: product.status as ProductEditorInitial['status'],
    visibility: product.visibility as ProductEditorInitial['visibility'],
    price: toDecimalString(product.price, currency),
    compareAtPrice: product.compareAtPrice ? toDecimalString(product.compareAtPrice, currency) : '',
    cost: product.cost ? toDecimalString(product.cost, currency) : '',
    trackInventory: product.trackInventory,
    stockQuantity: String(product.stockQuantity),
    lowStockThreshold: String(product.lowStockThreshold),
    allowBackorder: product.allowBackorder,
    weightGrams: product.weightGrams ? String(product.weightGrams) : '',
    shippingRequired: product.shippingRequired,
    freeShipping: product.freeShipping,
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    tags: product.tags,
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.altText,
      isPrimary: image.isPrimary,
    })),
    options: product.options.map((option) => ({
      id: option.id,
      name: option.name,
      values: option.values.map((value) => ({ id: value.id, value: value.value })),
    })),
    variants: product.variants.map((variant) => ({
      signature: variant.signature,
      title: variant.title,
      sku: variant.sku ?? '',
      price: variant.price ? toDecimalString(variant.price, currency) : '',
      stockQuantity: String(variant.stockQuantity),
      barcode: variant.barcode ?? '',
      isActive: variant.isActive,
      optionValueIds: variant.optionValues.map((link) => link.optionValueId),
    })),
    related: product.relatedFrom.map((link) => ({
      id: link.related.id,
      name: link.related.name,
      price: link.related.price,
      imageUrl: link.related.images[0]?.url ?? null,
    })),
  };
}
