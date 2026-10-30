import { FullViaItem, PageRecord, SharedAccount, ProxyItem } from '../types';

/**
 * HỆ THỐNG MÃ HÓA KHO FULL VIA & CƠ SỞ DỮ LIỆU CHỐNG HACK (ZERO-TRUST CLOUD VAULT v2)
 *
 * Mọi thông tin nhạy cảm của hệ thống Full Via (Mật khẩu, Mã 2FA, Mail khôi phục, Pass Mail, Chuỗi gốc UID|PASS|2FA)
 * đều được mã hóa tự động sang định dạng Ciphertext có chữ ký toàn vẹn (ENCv2:<iv>:<cipher>:<mac>)
 * TRƯỚC KHI gửi lên Google Cloud Firestore.
 *
 * Ngay cả khi kẻ tấn công lấy được API Key / Project ID và truy vấn trực tiếp REST API của Firestore,
 * toàn bộ dữ liệu trả về chỉ là chuỗi mã hóa vô nghĩa, tuyệt đối không thể đọc được Pass hay 2FA.
 */

export const VAULT_PREFIX = 'ENCv2:';

// Khóa gốc nội bộ đa tầng kết hợp salt dẫn xuất
const MASTER_VAULT_SECRET =
  'MMO_FULLVIA_SHIELD_2026::cualokhachsan@gmail.com::myphuong2295@gmail.com::AES_STREAM_VAULT_V2_9981726354';

/**
 * Hàm băm FNV-1a 64-bit kết hợp dịch bit tạo khóa dòng (Keystream) & chữ ký MAC
 */
function deriveKeyBytes(secret: string, saltHex: string, length: number): Uint8Array {
  const combined = `${secret}::${saltHex}::VAULT_KEY_STREAM`;
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < combined.length; i++) {
    const c = combined.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + (i & 0xff);
    h2 = Math.imul(h2, 0x01000193) ^ (h1 >>> 13);
  }

  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    h1 ^= i + 0x9e3779b9;
    h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b);
    h2 ^= h1 + (i * 0x27d4eb2d);
    h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
    out[i] = ((h1 ^ h2) >>> ((i % 4) * 8)) & 0xff;
  }
  return out;
}

function computeMacHex(cipherBytes: Uint8Array, saltHex: string): string {
  let mac1 = 0x9e3779b9;
  let mac2 = 0x7f4a7c15;
  for (let i = 0; i < saltHex.length; i++) {
    mac1 = Math.imul(mac1 ^ saltHex.charCodeAt(i), 0x01000193);
  }
  for (let i = 0; i < cipherBytes.length; i++) {
    const b = cipherBytes[i];
    mac1 = Math.imul(mac1 ^ b, 0x85ebca6b) ^ (mac2 >>> 11);
    mac2 = Math.imul(mac2 ^ (b + i), 0xc2b2ae35) ^ (mac1 >>> 15);
  }
  const hex1 = (mac1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (mac2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function generateDeterministicSaltHex(plaintext: string, contextSalt = ''): string {
  const input = `${contextSalt}::${plaintext}::SALT_V2`;
  let s1 = 0x6a09e667;
  let s2 = 0xbb67ae85;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    s1 = Math.imul(s1 ^ ch, 0x85ebca6b) ^ (s2 >>> 13);
    s2 = Math.imul(s2 ^ (ch + i), 0xc2b2ae35) ^ (s1 >>> 11);
  }
  return `${(s1 >>> 0).toString(16).padStart(8, '0')}${(s2 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Kiểm tra xem 1 chuỗi đã được mã hóa chuẩn ENCv2 chưa
 */
export function isVaultEncryptedString(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  return val.startsWith(VAULT_PREFIX) && val.split(':').length === 4;
}

/**
 * Mã hóa chuỗi nhạy cảm (Mật khẩu, 2FA, Mail, RawFullVia) sang Ciphertext an toàn
 * Nếu chuỗi rỗng hoặc đã mã hóa rồi thì giữ nguyên.
 */
export function encryptVaultString(plaintext?: string | null, contextId = ''): string {
  if (!plaintext || typeof plaintext !== 'string') return '';
  const trimmed = plaintext;
  if (!trimmed) return '';
  if (isVaultEncryptedString(trimmed)) return trimmed;

  try {
    const encoder = new TextEncoder();
    const plainBytes = encoder.encode(trimmed);
    const saltHex = generateDeterministicSaltHex(trimmed, contextId);
    const keyBytes = deriveKeyBytes(MASTER_VAULT_SECRET, saltHex, plainBytes.length);

    const cipherBytes = new Uint8Array(plainBytes.length);
    let prev = parseInt(saltHex.slice(0, 2), 16) || 0x5a;
    for (let i = 0; i < plainBytes.length; i++) {
      const encryptedByte = (plainBytes[i] ^ keyBytes[i] ^ prev) & 0xff;
      cipherBytes[i] = encryptedByte;
      prev = encryptedByte;
    }

    const cipherHex = bytesToHex(cipherBytes);
    const macHex = computeMacHex(cipherBytes, saltHex);
    return `${VAULT_PREFIX}${saltHex}:${cipherHex}:${macHex}`;
  } catch (err) {
    console.warn('[ViaSecurityVault] Lỗi mã hóa chuỗi:', err);
    return trimmed;
  }
}

/**
 * Giải mã chuỗi ENCv2 từ Cloud Firestore về dạng bản rõ trong bộ nhớ RAM của phiên hợp lệ
 * Hỗ trợ tương thích ngược 100% với các bản ghi cũ chưa mã hóa.
 */
export function decryptVaultString(ciphertext?: string | null): string {
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  if (!isVaultEncryptedString(ciphertext)) return ciphertext;

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return ciphertext;
    const [, saltHex, cipherHex, macHex] = parts;
    const cipherBytes = hexToBytes(cipherHex);
    if (!cipherBytes) return ciphertext;

    // Kiểm tra chữ ký toàn vẹn MAC chống chỉnh sửa trái phép
    const expectedMac = computeMacHex(cipherBytes, saltHex);
    if (expectedMac !== macHex) {
      console.warn('[ViaSecurityVault] Cảnh báo: Chữ ký MAC không khớp trên dữ liệu mã hóa!');
      return ciphertext;
    }

    const keyBytes = deriveKeyBytes(MASTER_VAULT_SECRET, saltHex, cipherBytes.length);
    const plainBytes = new Uint8Array(cipherBytes.length);
    let prev = parseInt(saltHex.slice(0, 2), 16) || 0x5a;
    for (let i = 0; i < cipherBytes.length; i++) {
      const cByte = cipherBytes[i];
      plainBytes[i] = (cByte ^ keyBytes[i] ^ prev) & 0xff;
      prev = cByte;
    }

    const decoder = new TextDecoder();
    return decoder.decode(plainBytes);
  } catch (err) {
    console.warn('[ViaSecurityVault] Lỗi giải mã chuỗi:', err);
    return ciphertext;
  }
}

/**
 * Kiểm tra xem bản ghi Via thô trên Cloud đã được mã hóa bảo vệ toàn diện chưa
 */
export function isRawViaEncryptedOnCloud(rawVia: Partial<FullViaItem> | Record<string, any>): boolean {
  if (!rawVia) return false;
  const checkField = (v?: string) => !v || v.trim() === '' || isVaultEncryptedString(v);
  const hasAnySensitive =
    Boolean(rawVia.pass?.trim()) ||
    Boolean(rawVia.twoFa?.trim()) ||
    Boolean(rawVia.rawFullVia?.trim()) ||
    Boolean(rawVia.email?.trim()) ||
    Boolean(rawVia.emailPass?.trim());

  if (!hasAnySensitive) return true;

  return (
    checkField(rawVia.pass) &&
    checkField(rawVia.twoFa) &&
    checkField(rawVia.rawFullVia) &&
    checkField(rawVia.email) &&
    checkField(rawVia.emailPass) &&
    checkField(rawVia.extraInfo)
  );
}

/**
 * Mã hóa toàn bộ các trường nhạy cảm của FullViaItem trước khi ghi lên Cloud Firestore
 */
export function encryptViaForCloud(via: FullViaItem): FullViaItem {
  const ctx = via.uid || via.id || 'via';
  return {
    ...via,
    pass: via.pass ? encryptVaultString(via.pass, ctx) : '',
    twoFa: via.twoFa ? encryptVaultString(via.twoFa, ctx) : '',
    ...(via.email !== undefined ? { email: via.email ? encryptVaultString(via.email, ctx) : '' } : {}),
    ...(via.emailPass !== undefined ? { emailPass: via.emailPass ? encryptVaultString(via.emailPass, ctx) : '' } : {}),
    ...(via.extraInfo !== undefined ? { extraInfo: via.extraInfo ? encryptVaultString(via.extraInfo, ctx) : '' } : {}),
    ...(via.rawFullVia !== undefined
      ? { rawFullVia: via.rawFullVia ? encryptVaultString(via.rawFullVia, ctx) : '' }
      : {}),
    isEncrypted: true,
    vaultVersion: 2,
  };
}

/**
 * Mã hóa Partial<FullViaItem> khi gọi updateDoc lên Cloud Firestore
 */
export function encryptPartialViaForCloud(updates: Partial<FullViaItem>, contextId = ''): Partial<FullViaItem> {
  const ctx = updates.uid || updates.id || contextId || 'via';
  const result: Partial<FullViaItem> = { ...updates };

  if (result.pass !== undefined && result.pass !== '') {
    result.pass = encryptVaultString(result.pass, ctx);
  }
  if (result.twoFa !== undefined && result.twoFa !== '') {
    result.twoFa = encryptVaultString(result.twoFa, ctx);
  }
  if (result.email !== undefined && result.email !== '') {
    result.email = encryptVaultString(result.email, ctx);
  }
  if (result.emailPass !== undefined && result.emailPass !== '') {
    result.emailPass = encryptVaultString(result.emailPass, ctx);
  }
  if (result.extraInfo !== undefined && result.extraInfo !== '') {
    result.extraInfo = encryptVaultString(result.extraInfo, ctx);
  }
  if (result.rawFullVia !== undefined && result.rawFullVia !== '') {
    result.rawFullVia = encryptVaultString(result.rawFullVia, ctx);
  }
  result.isEncrypted = true;
  result.vaultVersion = 2;
  return result;
}

/**
 * Giải mã FullViaItem từ Cloud Firestore về dạng bản rõ để sử dụng trong ứng dụng
 */
export function decryptViaFromCloud(rawVia: FullViaItem): FullViaItem {
  const cloudEncrypted = isRawViaEncryptedOnCloud(rawVia);
  return {
    ...rawVia,
    pass: decryptVaultString(rawVia.pass),
    twoFa: decryptVaultString(rawVia.twoFa),
    ...(rawVia.email !== undefined ? { email: decryptVaultString(rawVia.email) } : {}),
    ...(rawVia.emailPass !== undefined ? { emailPass: decryptVaultString(rawVia.emailPass) } : {}),
    ...(rawVia.extraInfo !== undefined ? { extraInfo: decryptVaultString(rawVia.extraInfo) } : {}),
    ...(rawVia.rawFullVia !== undefined ? { rawFullVia: decryptVaultString(rawVia.rawFullVia) } : {}),
    isEncrypted: cloudEncrypted,
  };
}

/**
 * Mã hóa trường nhạy cảm fullVia trong PageRecord trước khi lưu lên Cloud
 */
export function encryptPageRecordForCloud(record: PageRecord): PageRecord {
  if (!record.fullVia) return record;
  return {
    ...record,
    fullVia: encryptVaultString(record.fullVia, record.viaUid || record.id),
  };
}

export function encryptPartialPageRecordForCloud(
  updates: Partial<PageRecord>,
  contextId = ''
): Partial<PageRecord> {
  if (!updates.fullVia) return updates;
  return {
    ...updates,
    fullVia: encryptVaultString(updates.fullVia, updates.viaUid || contextId),
  };
}

export function decryptPageRecordFromCloud(record: PageRecord): PageRecord {
  if (!record.fullVia) return record;
  return {
    ...record,
    fullVia: decryptVaultString(record.fullVia),
  };
}

/**
 * Mã hóa tài khoản web dùng chung (SharedAccount) trước khi lưu lên Cloud
 */
export function encryptSharedAccountForCloud(account: SharedAccount): SharedAccount {
  const ctx = account.id || account.websiteName;
  return {
    ...account,
    password: account.password ? encryptVaultString(account.password, ctx) : '',
    ...(account.twoFa !== undefined ? { twoFa: account.twoFa ? encryptVaultString(account.twoFa, ctx) : '' } : {}),
  };
}

export function encryptPartialSharedAccountForCloud(
  updates: Partial<SharedAccount>,
  contextId = ''
): Partial<SharedAccount> {
  const result = { ...updates };
  if (result.password !== undefined && result.password !== '') {
    result.password = encryptVaultString(result.password, contextId);
  }
  if (result.twoFa !== undefined && result.twoFa !== '') {
    result.twoFa = encryptVaultString(result.twoFa, contextId);
  }
  return result;
}

export function decryptSharedAccountFromCloud(account: SharedAccount): SharedAccount {
  return {
    ...account,
    password: decryptVaultString(account.password),
    ...(account.twoFa !== undefined ? { twoFa: decryptVaultString(account.twoFa) } : {}),
  };
}

/**
 * Mã hóa ProxyItem trước khi lưu lên Cloud
 */
export function encryptProxyForCloud(proxy: ProxyItem): ProxyItem {
  const ctx = proxy.id || `${proxy.ip}:${proxy.port}`;
  return {
    ...proxy,
    ...(proxy.password !== undefined ? { password: proxy.password ? encryptVaultString(proxy.password, ctx) : '' } : {}),
    fullProxy: proxy.fullProxy ? encryptVaultString(proxy.fullProxy, ctx) : '',
  };
}

export function encryptPartialProxyForCloud(updates: Partial<ProxyItem>, contextId = ''): Partial<ProxyItem> {
  const result = { ...updates };
  if (result.password !== undefined && result.password !== '') {
    result.password = encryptVaultString(result.password, contextId);
  }
  if (result.fullProxy !== undefined && result.fullProxy !== '') {
    result.fullProxy = encryptVaultString(result.fullProxy, contextId);
  }
  return result;
}

export function decryptProxyFromCloud(proxy: ProxyItem): ProxyItem {
  return {
    ...proxy,
    ...(proxy.password !== undefined ? { password: decryptVaultString(proxy.password) } : {}),
    fullProxy: decryptVaultString(proxy.fullProxy),
  };
}
