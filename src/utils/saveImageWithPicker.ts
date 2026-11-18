export interface FileSystemWritableLike {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}

export interface FileSystemFileHandleLike {
  name: string;
  createWritable: () => Promise<FileSystemWritableLike>;
}

export type ImageSaveFormat = 'png' | 'jpeg';

export type SavePickerTargetResult =
  | { status: 'picked'; handle: FileSystemFileHandleLike }
  | { status: 'cancelled' }
  | { status: 'unsupported' };

export function sanitizeImageFileName(rawName: string, format: ImageSaveFormat): string {
  const ext = format === 'png' ? 'png' : 'jpg';
  const stripped = (rawName || 'image')
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim();
  const safeBase = stripped || 'image';
  return `${safeBase}.${ext}`;
}

export function canvasToImageBlob(
  canvas: HTMLCanvasElement,
  format: ImageSaveFormat,
  quality = 0.94
): Promise<Blob> {
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Không thể tạo dữ liệu ảnh để lưu'));
        }
      },
      mime,
      format === 'png' ? undefined : quality
    );
  });
}

export async function urlOrDataUrlToBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) {
    throw new Error('Không thể đọc dữ liệu ảnh để lưu');
  }
  return res.blob();
}

/**
 * Mở hộp thoại hệ điều hành ("Save As") hỏi người dùng chọn thư mục & tên file trước khi lưu.
 * QUAN TRỌNG: Cần gọi ngay trong luồng click của người dùng (trước khi render canvas bất đồng bộ lâu)
 * để giữ nguyên User Activation của trình duyệt.
 */
export async function pickImageSaveTarget(
  suggestedBaseName: string,
  format: ImageSaveFormat
): Promise<SavePickerTargetResult> {
  const suggestedName = sanitizeImageFileName(suggestedBaseName, format);
  const pickerFn =
    typeof window !== 'undefined'
      ? (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike> })
          .showSaveFilePicker
      : undefined;

  if (typeof pickerFn !== 'function') {
    return { status: 'unsupported' };
  }

  try {
    const handle = await pickerFn({
      id: 'celeb24h-image-export',
      suggestedName,
      types:
        format === 'png'
          ? [
              {
                description: 'Ảnh PNG nét cao',
                accept: { 'image/png': ['.png'] },
              },
            ]
          : [
              {
                description: 'Ảnh JPEG nhẹ',
                accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
              },
            ],
    });
    return { status: 'picked', handle };
  } catch (err: unknown) {
    const errName = err instanceof Error ? err.name : '';
    if (errName === 'AbortError') {
      return { status: 'cancelled' };
    }
    // SecurityError (ví dụ chạy trong iframe) hoặc trình duyệt chặn picker -> fallback modal xác nhận
    return { status: 'unsupported' };
  }
}

export async function writeBlobToPickedHandle(
  handle: FileSystemFileHandleLike,
  blob: Blob
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export function triggerDirectBlobDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
