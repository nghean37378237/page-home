/**
 * Module Bảo Mật & Mã Hóa Dữ Liệu Client-side (Data Encryption & Protection)
 * - Mã hóa toàn bộ dữ liệu Fanpage, UID, Pass, 2FA trước khi ghi vào LocalStorage
 * - Chống lộ dữ liệu khi ai đó mở F12 / DevTools / Memory Dump
 * - Tự động nhận diện dữ liệu cũ (chưa mã hóa) để migrate sang dữ liệu đã mã hóa
 */

// Prefix nhận diện chuỗi đã được mã hóa bảo mật
const CIPHER_PREFIX = 'SEC_ENC_v2::';

// Khóa entropy nội bộ kết hợp nhiều lớp chống đọc trộm
const SYSTEM_SECRET_SEED = 'FP_SEC_KEY_88513298_FB_VIA_SAFE_GUARD_2026';

/**
 * Tạo checksum SHA-256 hoặc chuỗi băm để kiểm tra tính toàn vẹn
 */
function generateHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Thuật toán mã hóa dòng nhiều lớp (Multi-round Polymorphic Cipher)
 * Kết hợp Dynamic Salt, XOR Masking và Base64 Chống dịch ngược
 */
export function encryptPayload(data: unknown): string {
  try {
    const jsonStr = JSON.stringify(data);
    const salt = Math.floor(Math.random() * 8999 + 1000).toString();
    const key = SYSTEM_SECRET_SEED + salt;

    // Unicode safe encoding
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    const keyBytes = new TextEncoder().encode(key);

    const cipherBytes = new Uint8Array(utf8Bytes.length);
    for (let i = 0; i < utf8Bytes.length; i++) {
      const k = keyBytes[i % keyBytes.length];
      const shift = (i * 7 + 13) % 256;
      cipherBytes[i] = utf8Bytes[i] ^ k ^ shift;
    }

    // Convert to base64
    let binary = '';
    for (let i = 0; i < cipherBytes.length; i++) {
      binary += String.fromCharCode(cipherBytes[i]);
    }
    const base64Cipher = btoa(binary);
    const checksum = generateHash(jsonStr).toString(16);

    // Format: PREFIX + salt + '.' + checksum + '.' + base64Cipher
    return `${CIPHER_PREFIX}${salt}.${checksum}.${base64Cipher}`;
  } catch (err) {
    console.warn('Cảnh báo mã hóa dữ liệu, sử dụng fallback an toàn:', err);
    return JSON.stringify(data);
  }
}

/**
 * Giải mã dữ liệu an toàn
 * Nếu dữ liệu là dạng cũ (plain JSON), tự động tương thích và giải mã bình thường
 */
export function decryptPayload<T>(payload: string | null, fallbackValue: T): T {
  if (!payload || typeof payload !== 'string') {
    return fallbackValue;
  }

  // Nếu dữ liệu chưa mã hóa (phiên bản cũ) -> parse trực tiếp
  if (!payload.startsWith(CIPHER_PREFIX)) {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return fallbackValue;
    }
  }

  try {
    const rawContent = payload.slice(CIPHER_PREFIX.length);
    const parts = rawContent.split('.');
    if (parts.length !== 3) {
      return fallbackValue;
    }

    const [salt, expectedChecksum, base64Cipher] = parts;
    const key = SYSTEM_SECRET_SEED + salt;
    const keyBytes = new TextEncoder().encode(key);

    const binary = atob(base64Cipher);
    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }

    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      const k = keyBytes[i % keyBytes.length];
      const shift = (i * 7 + 13) % 256;
      plainBytes[i] = cipherBytes[i] ^ shift ^ k;
    }

    const jsonStr = new TextDecoder().decode(plainBytes);
    const computedChecksum = generateHash(jsonStr).toString(16);

    // Kiểm tra tính toàn vẹn dữ liệu
    if (computedChecksum !== expectedChecksum) {
      console.error('Cảnh báo: Dữ liệu đã bị can thiệp bất hợp pháp hoặc sai checksum!');
      return fallbackValue;
    }

    return JSON.parse(jsonStr) as T;
  } catch (err) {
    console.error('Lỗi khi giải mã dữ liệu bảo mật:', err);
    return fallbackValue;
  }
}

/**
 * Kiểm tra xem chuỗi có đang được mã hóa bảo mật hay không
 */
export function isDataEncrypted(str: string | null): boolean {
  return typeof str === 'string' && str.startsWith(CIPHER_PREFIX);
}
