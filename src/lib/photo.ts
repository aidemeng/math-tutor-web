import { ApiError } from '../api/errors';

export interface PhotoPayload {
  mimeType: 'image/png' | 'image/jpeg';
  data: string;
  preview: string;
}

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 4096;
const MAX_PIXELS = 16_000_000;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ApiError('PHOTO_READ_FAILED', 0));
    reader.readAsDataURL(file);
  });
}

function measure(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new ApiError('PHOTO_FORMAT_INVALID', 422));
    image.src = url;
  });
}

/** 与后端一致的本地前置校验，失败时给出可读错误，避免白传一趟。 */
export async function readPhotoFile(file: File): Promise<PhotoPayload> {
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    throw new ApiError('PHOTO_FORMAT_INVALID', 422);
  }
  if (file.size > MAX_BYTES) throw new ApiError('PHOTO_TOO_LARGE', 413);

  const dataURL = await readAsDataURL(file);
  const comma = dataURL.indexOf(',');
  if (comma < 0) throw new ApiError('PHOTO_READ_FAILED', 0);
  const base64 = dataURL.slice(comma + 1);

  const { width, height } = await measure(dataURL);
  if (!width || !height || width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
    throw new ApiError('PHOTO_DIMENSIONS_INVALID', 422);
  }

  return {
    mimeType: file.type,
    data: base64,
    preview: URL.createObjectURL(file),
  };
}
