import 'server-only';

import { prisma } from '@/db/client';
import { decryptJson, encryptJson, maskSecret } from '@/lib/crypto';
import { parseDelimited, toRowObjects } from '@/lib/delimited';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { parseMoney } from '@/lib/money';
import { normalisePhone } from '@/lib/phone';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  getIntegrationProvider,
  importFieldsFor,
  INTEGRATION_PROVIDERS,
  requiredImportFieldsFor,
  type ImportTarget,
  type IntegrationProvider,
} from '@/server/catalog/integrations';
import { assertPermission, type StoreContext } from '@/server/policies/context';

import { recordAudit } from './audit-service';
import { createOrder, resolveOrderLines } from './order-service';
import { createProduct } from './product-service';
import { getStore } from './store-service';

/**
 * External integrations and imports.
 *
 * Two rules shape this file.
 *
 * Credentials are write-only. They are encrypted before they touch the
 * database, and a read never returns the plaintext — the UI gets a mask and a
 * "replace" affordance instead. A merchant who wants to see a secret again has
 * to fetch it from the provider that issued it.
 *
 * An import is a job, not a request. Rows are persisted first, then processed,
 * so a browser that closes mid-import does not lose the work and the merchant
 * can see exactly which rows failed and why. A job that finishes with some
 * failures is `COMPLETED_WITH_ERRORS`, which is a different thing from
 * `FAILED` — the difference matters when deciding whether to retry.
 */

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

export interface IntegrationCard {
  provider: IntegrationProvider;
  connectionId: string | null;
  status: 'DISCONNECTED' | 'CONNECTED' | 'ERROR';
  /** Non-secret credential values, safe to prefill in the form. */
  publicValues: Record<string, string>;
  /** Masks for secret fields that are already stored. */
  secretMasks: Record<string, string>;
  fieldMapping: Record<string, string>;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
}

export async function listIntegrations(context: StoreContext): Promise<IntegrationCard[]> {
  assertPermission(context, 'integrations.manage');

  const connections = await prisma.integrationConnection.findMany({
    where: { storeId: context.storeId },
  });
  const byKey = new Map(connections.map((row) => [row.providerKey, row]));

  return INTEGRATION_PROVIDERS.map((provider) => {
    const connection = byKey.get(provider.key);
    const credentials = connection?.credentialsEncrypted
      ? decryptJson<Record<string, string>>(connection.credentialsEncrypted)
      : null;

    const publicValues: Record<string, string> = {};
    const secretMasks: Record<string, string> = {};

    for (const field of provider.credentialFields) {
      const value = credentials?.[field.key];
      if (!value) continue;
      if (field.secret) {
        secretMasks[field.key] = maskSecret(value);
      } else {
        publicValues[field.key] = value;
      }
    }

    return {
      provider,
      connectionId: connection?.id ?? null,
      status: connection?.status ?? 'DISCONNECTED',
      publicValues,
      secretMasks,
      fieldMapping: (connection?.fieldMapping as Record<string, string> | null) ?? {},
      lastSyncAt: connection?.lastSyncAt ?? null,
      lastSyncStatus: connection?.lastSyncStatus ?? null,
      lastSyncMessage: connection?.lastSyncMessage ?? null,
    };
  });
}

export interface ConnectInput {
  providerKey: string;
  /** Only the fields the merchant actually typed. A blank secret keeps the stored one. */
  credentials: Record<string, string>;
  fieldMapping?: Record<string, string>;
}

export async function connectIntegration(
  context: StoreContext,
  input: ConnectInput,
): Promise<void> {
  assertPermission(context, 'integrations.manage');

  const provider = getIntegrationProvider(input.providerKey);
  if (!provider) throw new AppError('NOT_FOUND', 'Integration not found.');

  const existing = await prisma.integrationConnection.findUnique({
    where: { storeId_providerKey: { storeId: context.storeId, providerKey: provider.key } },
    select: { id: true, credentialsEncrypted: true },
  });

  const stored = existing?.credentialsEncrypted
    ? (decryptJson<Record<string, string>>(existing.credentialsEncrypted) ?? {})
    : {};

  // A blank secret means "leave it alone", not "clear it" — otherwise editing
  // an unrelated field would silently wipe a credential the merchant cannot
  // read back to retype.
  const merged: Record<string, string> = { ...stored };
  for (const field of provider.credentialFields) {
    const submitted = input.credentials[field.key]?.trim() ?? '';
    if (submitted.length > 0) {
      merged[field.key] = submitted;
    } else if (!field.secret) {
      delete merged[field.key];
    }
  }

  const missing = provider.credentialFields
    .filter((field) => field.required && !merged[field.key])
    .map((field) => field.key);

  if (missing.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Missing credentials.', {
      fieldErrors: Object.fromEntries(missing.map((key) => [key, ['validation.required']])),
    });
  }

  const data = {
    name: provider.nameAr,
    status: 'CONNECTED' as const,
    credentialsEncrypted:
      Object.keys(merged).length > 0 ? encryptJson(merged) : null,
    ...(input.fieldMapping ? { fieldMapping: input.fieldMapping as object } : {}),
  };

  await prisma.integrationConnection.upsert({
    where: { storeId_providerKey: { storeId: context.storeId, providerKey: provider.key } },
    create: { storeId: context.storeId, providerKey: provider.key, ...data },
    update: data,
  });

  await recordAudit(context, {
    action: 'INTEGRATION_CONNECTED',
    entityType: 'integration',
    entityId: provider.key,
    // Deliberately records which fields changed, never their values.
    after: { fields: Object.keys(input.credentials).filter((key) => input.credentials[key]) },
  });
}

export async function disconnectIntegration(
  context: StoreContext,
  providerKey: string,
): Promise<void> {
  assertPermission(context, 'integrations.manage');

  const result = await prisma.integrationConnection.updateMany({
    where: { storeId: context.storeId, providerKey },
    data: {
      status: 'DISCONNECTED',
      credentialsEncrypted: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
    },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 'Integration not found.');

  await recordAudit(context, {
    action: 'INTEGRATION_DISCONNECTED',
    entityType: 'integration',
    entityId: providerKey,
  });
}

/**
 * Check a connection.
 *
 * REBUILD PROPOSAL — each provider needs a real driver to be verified against
 * its API. Until those exist, this validates that every required credential is
 * present and records the result, so the status a merchant sees is honest
 * about what was actually checked rather than claiming a live handshake.
 */
export async function testIntegration(
  context: StoreContext,
  providerKey: string,
): Promise<{ ok: boolean; message: string }> {
  assertPermission(context, 'integrations.manage');
  enforceRateLimit('integrationTest', context.storeId);

  const provider = getIntegrationProvider(providerKey);
  if (!provider) throw new AppError('NOT_FOUND', 'Integration not found.');

  const connection = await prisma.integrationConnection.findUnique({
    where: { storeId_providerKey: { storeId: context.storeId, providerKey } },
    select: { credentialsEncrypted: true },
  });

  const credentials = connection?.credentialsEncrypted
    ? (decryptJson<Record<string, string>>(connection.credentialsEncrypted) ?? {})
    : {};

  const missing = provider.credentialFields.filter(
    (field) => field.required && !credentials[field.key],
  );

  const ok = missing.length === 0;
  const message = ok ? 'integrations.testPassed' : 'integrations.testMissingCredentials';

  await prisma.integrationConnection.updateMany({
    where: { storeId: context.storeId, providerKey },
    data: {
      status: ok ? 'CONNECTED' : 'ERROR',
      lastSyncStatus: ok ? 'OK' : 'ERROR',
      lastSyncMessage: message,
    },
  });

  return { ok, message };
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export interface ImportPreview {
  columns: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
  /** Our best guess at column → platform field, which the merchant can override. */
  suggestedMapping: Record<string, string>;
}

const MAX_IMPORT_ROWS = 2000;

export function buildImportPreview(text: string, target: ImportTarget): ImportPreview {
  const { columns, rows } = parseDelimited(text);
  if (columns.length === 0) throw new AppError('VALIDATION_FAILED', 'File has no header row.');

  const objects = toRowObjects({ columns, rows }).slice(0, MAX_IMPORT_ROWS);

  return {
    columns,
    rows: objects.slice(0, 20),
    totalRows: objects.length,
    suggestedMapping: suggestMapping(columns, target),
  };
}

/** Match columns to platform fields by normalised name, in Arabic or English. */
function suggestMapping(columns: string[], target: ImportTarget): Record<string, string> {
  const fields = importFieldsFor(target);
  const mapping: Record<string, string> = {};

  for (const column of columns) {
    const normalised = column.trim().toLowerCase().replace(/[\s_-]/g, '');
    const match = fields.find((field) => {
      if (field.toLowerCase() === normalised) return true;
      return (COLUMN_ALIASES[field] ?? []).some(
        (alias) => alias.toLowerCase().replace(/[\s_-]/g, '') === normalised,
      );
    });
    if (match) mapping[column] = match;
  }

  return mapping;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['اسم المنتج', 'المنتج', 'product', 'title', 'product name'],
  sku: ['رمز', 'كود', 'code'],
  price: ['السعر', 'amount'],
  compareAtPrice: ['السعر قبل الخصم', 'compare at price', 'old price'],
  stock: ['المخزون', 'الكمية المتوفرة', 'quantity in stock', 'inventory'],
  category: ['التصنيف', 'الفئة'],
  description: ['الوصف'],
  imageUrl: ['الصورة', 'رابط الصورة', 'image'],
  customerName: ['اسم العميل', 'الاسم', 'customer'],
  customerPhone: ['رقم الهاتف', 'الهاتف', 'phone', 'mobile'],
  state: ['الولاية', 'المنطقة', 'region'],
  city: ['المدينة', 'البلدية'],
  address: ['العنوان'],
  productName: ['اسم المنتج', 'المنتج', 'product'],
  quantity: ['الكمية', 'qty'],
  notes: ['ملاحظات', 'note'],
};

export interface StartImportInput {
  source: string;
  target: ImportTarget;
  /** column name → platform field */
  mapping: Record<string, string>;
  rows: Array<Record<string, string>>;
}

/**
 * Create a job and its rows, then process them.
 *
 * The job row is written before any processing, so a crash leaves a visible
 * PROCESSING job rather than nothing at all.
 */
export async function startImport(
  context: StoreContext,
  input: StartImportInput,
): Promise<{ jobId: string }> {
  assertPermission(context, input.target === 'products' ? 'products.create' : 'orders.create');
  enforceRateLimit('importJob', context.storeId);

  if (input.rows.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'Nothing to import.');
  }
  if (input.rows.length > MAX_IMPORT_ROWS) {
    throw new AppError('VALIDATION_FAILED', 'Too many rows.');
  }

  const mapped = Object.values(input.mapping);
  const missing = requiredImportFieldsFor(input.target).filter(
    (field) => !mapped.includes(field),
  );
  if (missing.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Required fields are not mapped.', {
      fieldErrors: { mapping: missing.map((field) => `import.missing.${field}`) },
    });
  }

  const job = await prisma.importJob.create({
    data: {
      storeId: context.storeId,
      source: input.source,
      status: 'PROCESSING',
      totalRows: input.rows.length,
      createdBy: context.actor.id,
      startedAt: new Date(),
      payload: { target: input.target, mapping: input.mapping } as object,
      rows: {
        create: input.rows.map((row, index) => ({
          rowIndex: index,
          data: translateRow(row, input.mapping) as object,
        })),
      },
    },
    select: { id: true },
  });

  await processImportJob(context, job.id);

  return { jobId: job.id };
}

/** Re-key a raw row from column names to platform field names. */
function translateRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const translated: Record<string, string> = {};
  for (const [column, field] of Object.entries(mapping)) {
    if (!field) continue;
    const value = row[column];
    if (value !== undefined && value !== '') translated[field] = value;
  }
  return translated;
}

/**
 * Process every pending row of a job.
 *
 * Each row is its own unit of work: one bad row is recorded and skipped rather
 * than aborting the import, because a merchant importing 400 orders does not
 * want row 7 to lose the other 399.
 */
export async function processImportJob(context: StoreContext, jobId: string): Promise<void> {
  const job = await prisma.importJob.findFirst({
    where: { id: jobId, storeId: context.storeId },
    select: { id: true, payload: true },
  });
  if (!job) throw new AppError('NOT_FOUND', 'Import job not found.');

  const payload = (job.payload as { target?: ImportTarget } | null) ?? {};
  const target: ImportTarget = payload.target === 'orders' ? 'orders' : 'products';

  const rows = await prisma.importRow.findMany({
    where: { jobId, status: 'PENDING' },
    orderBy: { rowIndex: 'asc' },
  });

  const store = await getStore(context.storeId);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const data = (row.data as Record<string, string> | null) ?? {};

    try {
      const outcome =
        target === 'products'
          ? await importProductRow(context, data)
          : await importOrderRow(context, data, store.currency, store.country);

      if (outcome.status === 'IMPORTED') imported += 1;
      else skipped += 1;

      await prisma.importRow.update({
        where: { id: row.id },
        data: {
          status: outcome.status,
          createdEntityId: outcome.entityId ?? null,
          error: outcome.reason ?? null,
        },
      });
    } catch (error) {
      failed += 1;
      const message =
        error instanceof AppError ? error.code : 'import.unexpectedError';
      logger.warn('import row failed', { entityId: row.id, error: String(error) });

      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: 'FAILED', error: message },
      });
    }
  }

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      imported,
      skipped,
      failed,
      // A run where nothing landed is a failure; a run with some casualties is
      // a different, recoverable thing.
      status:
        failed > 0 && imported === 0
          ? 'FAILED'
          : failed > 0
            ? 'COMPLETED_WITH_ERRORS'
            : 'COMPLETED',
      finishedAt: new Date(),
    },
  });

  await recordAudit(context, {
    action: 'IMPORT_COMPLETED',
    entityType: 'import_job',
    entityId: jobId,
    after: { imported, skipped, failed, target },
  });
}

interface RowOutcome {
  status: 'IMPORTED' | 'SKIPPED';
  entityId?: string;
  reason?: string;
}

async function importProductRow(
  context: StoreContext,
  data: Record<string, string>,
): Promise<RowOutcome> {
  const name = data.name?.trim();
  if (!name) return { status: 'SKIPPED', reason: 'import.missingName' };

  const price = parseMoney(data.price ?? '', 'LYD');
  if (price === null) return { status: 'SKIPPED', reason: 'import.invalidPrice' };

  // Importing twice should not double the catalogue.
  const duplicate = await prisma.product.findFirst({
    where: {
      storeId: context.storeId,
      archivedAt: null,
      ...(data.sku ? { sku: data.sku.trim() } : { name }),
    },
    select: { id: true },
  });
  if (duplicate) return { status: 'SKIPPED', entityId: duplicate.id, reason: 'import.duplicate' };

  const compareAtPrice = data.compareAtPrice ? parseMoney(data.compareAtPrice, 'LYD') : null;
  const stock = Number.parseInt(data.stock ?? '0', 10);

  const created = await createProduct(context, {
    name,
    status: 'DRAFT',
    visibility: 'VISIBLE',
    price,
    // An invalid compare-at price is dropped rather than failing the row: it is
    // decoration, not the thing being imported.
    compareAtPrice: compareAtPrice !== null && compareAtPrice > price ? compareAtPrice : undefined,
    description: data.description ?? null,
    sku: data.sku ?? null,
    trackInventory: true,
    stockQuantity: Number.isFinite(stock) && stock > 0 ? stock : 0,
    lowStockThreshold: 5,
    allowBackorder: false,
    shippingRequired: true,
    freeShipping: false,
    upsellEnabled: false,
    tags: [],
    categoryIds: [],
    collectionIds: [],
    relatedProductIds: [],
    images: data.imageUrl ? [{ url: data.imageUrl, position: 0, isPrimary: true }] : [],
    options: [],
    variants: [],
    offers: [],
  });

  return { status: 'IMPORTED', entityId: created.id };
}

async function importOrderRow(
  context: StoreContext,
  data: Record<string, string>,
  currency: string,
  country: string,
): Promise<RowOutcome> {
  const phone = data.customerPhone?.trim();
  if (!phone) return { status: 'SKIPPED', reason: 'import.missingPhone' };

  const productName = data.productName?.trim();
  if (!productName) return { status: 'SKIPPED', reason: 'import.missingProduct' };

  const product = await prisma.product.findFirst({
    where: { storeId: context.storeId, archivedAt: null, name: productName },
    select: { id: true },
  });
  if (!product) return { status: 'SKIPPED', reason: 'import.productNotFound' };

  const quantity = Number.parseInt(data.quantity ?? '1', 10);
  const unitPrice = data.price ? parseMoney(data.price, currency) : null;

  const lines = await resolveOrderLines(
    prisma,
    context.storeId,
    [
      {
        productId: product.id,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unitPrice,
      },
    ],
    // An import is staff-initiated, so a price column is honoured — the same
    // trust the manual-order form gets, and never what a storefront gets.
    { allowPriceOverride: true },
  );

  const order = await createOrder(
    context.storeId,
    {
      source: 'IMPORT',
      customerName: data.customerName?.trim() || phone,
      customerPhone: normalisePhone(phone, country).canonical,
      state: data.state ?? '',
      city: data.city ?? '',
      address: data.address ?? '',
      notes: data.notes ?? null,
      lines,
      shippingAmount: 0,
      discountAmount: 0,
      actor: { type: 'USER', id: context.actor.id, name: context.actor.name },
    },
    currency,
    country,
  );

  return { status: 'IMPORTED', entityId: order.id };
}

export async function listImportJobs(context: StoreContext, limit = 25) {
  assertPermission(context, 'integrations.manage');

  return prisma.importJob.findMany({
    where: { storeId: context.storeId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      source: true,
      status: true,
      totalRows: true,
      imported: true,
      skipped: true,
      failed: true,
      createdAt: true,
      finishedAt: true,
      payload: true,
    },
  });
}

export async function getImportJob(context: StoreContext, jobId: string) {
  assertPermission(context, 'integrations.manage');

  const job = await prisma.importJob.findFirst({
    where: { id: jobId, storeId: context.storeId },
    include: {
      // Only the rows that need attention: a merchant reviewing a finished
      // import cares about what did not land, not about the 380 that did.
      rows: {
        where: { status: { in: ['FAILED', 'SKIPPED'] } },
        orderBy: { rowIndex: 'asc' },
        take: 200,
      },
    },
  });
  if (!job) throw new AppError('NOT_FOUND', 'Import job not found.');

  return job;
}
