import { NextResponse } from 'next/server';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireStoreContext } from '@/server/policies/context';
import { getStorage, validateImage } from '@/server/storage';

/**
 * Image upload endpoint.
 *
 * A route handler rather than a server action: the client needs real upload
 * progress, and XHR gives it that where a server action does not.
 *
 * Every upload is authorised, rate limited, size checked and content-sniffed
 * before a byte is written, and is namespaced under the authorised store id —
 * never a store id taken from the request.
 */
export async function POST(request: Request) {
  try {
    const context = await requireStoreContext();

    if (!context.permissions.includes('products.edit') && !context.permissions.includes('storefront.manage')) {
      throw new AppError('FORBIDDEN', 'Upload not permitted.');
    }

    enforceRateLimit('upload', context.storeId);

    const formData = await request.formData();
    const file = formData.get('file');
    const folder = String(formData.get('folder') ?? 'products');

    if (!(file instanceof File)) {
      throw new AppError('VALIDATION_FAILED', 'No file provided.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateImage({
      name: file.name,
      type: file.type,
      size: buffer.byteLength,
      head: buffer.subarray(0, 16),
    });

    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'UPLOAD_FAILED',
            reason: validation.reason,
            maxMb: 5,
          },
        },
        { status: 422 },
      );
    }

    const stored = await getStorage().put({
      storeId: context.storeId,
      folder,
      filename: file.name,
      contentType: file.type,
      data: buffer,
    });

    return NextResponse.json({ ok: true, data: stored });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.httpStatus },
      );
    }

    logger.error('upload failed', error);
    return NextResponse.json(
      { ok: false, error: { code: 'UPLOAD_FAILED', message: 'Upload failed.' } },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
