import 'server-only';

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { safeFilename } from '@/lib/slug';

/**
 * Storage abstraction.
 *
 * React components never talk to a storage backend. Everything goes through
 * this interface, so moving from the local disk to S3 or Supabase Storage is
 * one new implementation of `StorageDriver` and a change to `getStorage()` —
 * no call site changes.
 */

export interface StoredFile {
  url: string;
  path: string;
  sizeBytes: number;
  contentType: string;
}

export interface StorageDriver {
  put(input: {
    storeId: string;
    folder: string;
    filename: string;
    contentType: string;
    data: Buffer;
  }): Promise<StoredFile>;
  remove(path: string): Promise<void>;
}

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Server-side validation of an upload.
 *
 * The declared MIME type is not trusted on its own: the magic bytes are
 * checked too, so a .php renamed to .jpg is rejected before it is written.
 */
export function validateImage(file: {
  name: string;
  type: string;
  size: number;
  head: Buffer;
}): { ok: true } | { ok: false; reason: 'type' | 'size' | 'content' } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, reason: 'type' };
  }
  if (file.size > MAX_IMAGE_BYTES || file.size === 0) {
    return { ok: false, reason: 'size' };
  }
  if (!looksLikeImage(file.head)) {
    return { ok: false, reason: 'content' };
  }
  return { ok: true };
}

function looksLikeImage(head: Buffer): boolean {
  if (head.length < 12) return false;

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return true;
  }
  // GIF87a / GIF89a
  if (head.subarray(0, 6).toString('ascii').startsWith('GIF8')) return true;
  // RIFF....WEBP
  if (
    head.subarray(0, 4).toString('ascii') === 'RIFF' &&
    head.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true;
  }
  // ISO-BMFF (AVIF/HEIF) box type at offset 4
  if (head.subarray(4, 8).toString('ascii') === 'ftyp') return true;

  return false;
}

/**
 * Local filesystem driver.
 *
 * Files land under public/uploads/{storeId}/{folder}/ — namespaced by store so
 * one tenant's uploads can never collide with another's. Filenames are
 * sanitised and prefixed with a random token, so a merchant cannot choose a
 * path or overwrite an existing file.
 */
class LocalStorageDriver implements StorageDriver {
  private readonly root = process.env.UPLOAD_DIR ?? './public/uploads';

  async put(input: {
    storeId: string;
    folder: string;
    filename: string;
    contentType: string;
    data: Buffer;
  }): Promise<StoredFile> {
    const safeFolder = input.folder.replace(/[^a-z0-9-]/gi, '') || 'misc';
    const token = Math.random().toString(36).slice(2, 10);
    const name = `${token}-${safeFilename(input.filename)}`;
    const relativeDir = join(input.storeId, safeFolder);
    const absoluteDir = join(process.cwd(), this.root, relativeDir);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, name), input.data);

    const path = `${relativeDir}/${name}`.replace(/\\/g, '/');
    return {
      url: `/uploads/${path}`,
      path,
      sizeBytes: input.data.byteLength,
      contentType: input.contentType,
    };
  }

  async remove(path: string): Promise<void> {
    // Reject anything that tries to escape the upload root.
    if (path.includes('..') || path.startsWith('/')) {
      throw new AppError('VALIDATION_FAILED', 'Invalid file path.');
    }
    try {
      await unlink(join(process.cwd(), this.root, path));
    } catch (error) {
      logger.warn('failed to remove stored file', { entityId: path, error: String(error) });
    }
  }
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  driver ??= new LocalStorageDriver();
  return driver;
}

/** Test seam — lets a test swap in an in-memory driver. */
export function setStorage(next: StorageDriver): void {
  driver = next;
}
