import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env.js';
import { ValidationError } from '../errors/index.js';

import { logger } from './logger.js';

/**
 * Image storage abstraction.
 *
 *  - Production: Cloudinary (signed REST upload — no SDK dependency).
 *  - Development: local disk under ./uploads, served by Express.
 *
 * Every file is verified by magic bytes; the stored extension is derived from
 * the detected type, never from the client-supplied filename.
 */

export interface StoredImage {
  url: string;
  publicId: string | null;
}

type ImageKind = { ext: 'jpg' | 'png' | 'webp'; mime: string };

export function detectImageType(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

export const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const LOCAL_LISTING_DIR = path.join(LOCAL_UPLOAD_ROOT, 'listings');

function cloudinarySignature(params: Record<string, string>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1')
    .update(toSign + env.CLOUDINARY_API_SECRET)
    .digest('hex');
}

async function uploadToCloudinary(buf: Buffer, kind: ImageKind): Promise<StoredImage> {
  const params = {
    folder: `${env.CLOUDINARY_FOLDER}/listings`,
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: kind.mime }), `upload.${kind.ext}`);
  form.append('api_key', env.CLOUDINARY_API_KEY ?? '');
  form.append('folder', params.folder);
  form.append('timestamp', params.timestamp);
  form.append('signature', cloudinarySignature(params));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json()) as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!res.ok || !body.secure_url || !body.public_id) {
    logger.error({ status: res.status, error: body.error?.message }, 'Cloudinary upload failed');
    throw new Error('Image upload failed');
  }
  return { url: body.secure_url, publicId: body.public_id };
}

async function saveLocally(buf: Buffer, kind: ImageKind): Promise<StoredImage> {
  await fs.mkdir(LOCAL_LISTING_DIR, { recursive: true });
  const filename = `${randomUUID()}.${kind.ext}`;
  await fs.writeFile(path.join(LOCAL_LISTING_DIR, filename), buf);
  const base = env.PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
  return { url: `${base}/uploads/listings/${filename}`, publicId: `local:${filename}` };
}

/** Validate and persist a batch of uploaded images. */
export async function storeImages(files: Express.Multer.File[]): Promise<StoredImage[]> {
  const kinds = files.map((f) => detectImageType(f.buffer));
  const badIndex = kinds.findIndex((k) => k === null);
  if (badIndex !== -1) {
    throw new ValidationError('Only real JPEG, PNG or WebP images are allowed', {
      photos: [`"${files[badIndex]?.originalname ?? 'file'}" is not a supported image`],
    });
  }

  const store = env.cloudinaryConfigured ? uploadToCloudinary : saveLocally;
  return Promise.all(files.map((f, i) => store(f.buffer, kinds[i] as ImageKind)));
}

/** Best-effort deletion; failures are logged, never thrown. */
export async function deleteImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId) return;
  try {
    if (publicId.startsWith('local:')) {
      const name = path.basename(publicId.slice('local:'.length));
      await fs.unlink(path.join(LOCAL_LISTING_DIR, name));
      return;
    }
    if (!env.cloudinaryConfigured) return;
    const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000).toString() };
    const form = new FormData();
    form.append('public_id', params.public_id);
    form.append('timestamp', params.timestamp);
    form.append('api_key', env.CLOUDINARY_API_KEY ?? '');
    form.append('signature', cloudinarySignature(params));
    await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    logger.warn({ err, publicId }, 'Image deletion failed (ignored)');
  }
}
