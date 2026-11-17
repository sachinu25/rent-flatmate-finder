import multer from 'multer';

export const MAX_PHOTOS_PER_LISTING = 10;
export const MAX_PHOTOS_PER_UPLOAD = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Multer instance — files are buffered in memory (≤ 8 × 5 MB) so they can be
 * content-sniffed before anything is persisted. The client-declared mimetype is
 * only a first filter; storage.ts verifies the actual bytes.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS_PER_UPLOAD, fields: 40, fieldSize: 64 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});
