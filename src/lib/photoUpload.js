import { data } from '@/api/data';

/**
 * Site photos are 4–12 MB straight off a phone. They are shrunk on the phone
 * (about 1600px on the long side, JPEG 0.7 — roughly 300 KB) and uploaded three at
 * a time with progress, so a report with several photos is quick on site wifi
 * or mobile data.
 */
export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.7;
export const UPLOAD_CONCURRENCY = 3;

/** The size that fits within `max` on its long side, never enlarging. */
export function fitWithin(width, height, max = MAX_DIMENSION) {
  const longest = Math.max(width, height);
  if (!longest || longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** A smaller JPEG of the photo; the original is returned if the browser cannot shrink it. */
export async function compressImage(file) {
  if (!file || !String(file.type).startsWith('image/') || typeof document === 'undefined') return file;
  try {
    const bitmap = typeof createImageBitmap === 'function' ? await createImageBitmap(file) : null;
    if (!bitmap) return file;
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === 'function') bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], String(file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** A thumbnail address for the screen; none when the browser cannot make one. */
const previewOf = (file) => {
  try {
    return typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
  } catch {
    return '';
  }
};

/**
 * Compress and upload files with a small pool. `onProgress({done, total})` fires
 * as each finishes. A photo that fails is reported in `failed`, never dropped
 * quietly, and the others still go up.
 */
export async function uploadPhotos(files, { onProgress, concurrency = UPLOAD_CONCURRENCY, upload = (f) => data.uploadPrivate(f) } = {}) {
  const queue = files.map((file, index) => ({ file, index }));
  const uploaded = new Array(files.length).fill(null);
  const failed = [];
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const { file, index } = queue.shift();
      try {
        const small = await compressImage(file);
        const file_uri = await upload(small);
        if (!file_uri) throw new Error('no uri');
        uploaded[index] = { file_uri, preview: previewOf(small) };
      } catch {
        failed.push(file.name || `photo ${index + 1}`);
      }
      done += 1;
      onProgress?.({ done, total: files.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return { photos: uploaded.filter(Boolean), failed };
}
