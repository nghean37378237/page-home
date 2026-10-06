/**
 * Tiện ích tạo mã 2FA 6 số live trực tiếp (tương tự 2fa.live)
 * Dùng chuẩn RFC 6238 TOTP với Web Crypto API sẵn có trong trình duyệt
 */

function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s\-=]/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export async function generateTOTPCode(
  secret: string
): Promise<{ code: string; remainingSeconds: number } | null> {
  try {
    const cleanSecret = secret.replace(/\s+/g, '');
    if (!cleanSecret || cleanSecret.length < 8) return null;

    const keyBytes = base32ToBytes(cleanSecret);
    if (keyBytes.length === 0) return null;

    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    const remainingSeconds = 30 - (epoch % 30);

    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    // counter is 64-bit big endian integer
    view.setUint32(0, 0, false);
    view.setUint32(4, counter, false);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
    const hash = new Uint8Array(signature);
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    const code = otp.toString().padStart(6, '0');
    return { code, remainingSeconds };
  } catch (err) {
    console.error('Lỗi khi tính mã TOTP:', err);
    return null;
  }
}
