/**
 * Implémentation RFC 6238 (TOTP) & RFC 4648 (Base32) via Web Crypto API
 * Compatible 100% avec Microsoft Authenticator (SHA-1, 6 chiffres, période 30s).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function normalizeBase32(input: string): string {
  return (input || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
}

export function generateTotpSecret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);

  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function formatSecretForDisplay(secret: string): string {
  const clean = normalizeBase32(secret);
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

function base32ToBytes(base32: string): Uint8Array {
  const clean = normalizeBase32(base32);
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
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

export function buildOtpAuthUri(params: {
  accountName: string;
  secret: string;
  issuer?: string;
}): string {
  const issuer = (params.issuer || 'FIDE Chess Ledger').trim();
  const account = (params.accountName || 'Joueur').trim();
  const cleanSecret = normalizeBase32(params.secret);
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const query = new URLSearchParams({
    secret: cleanSecret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

export async function generateTotpCode(
  secret: string,
  timestampMs = Date.now(),
  stepOffset = 0
): Promise<string> {
  const keyBytes = base32ToBytes(secret);
  if (keyBytes.length === 0) {
    throw new Error('Clé secrète TOTP invalide.');
  }

  const counter = Math.floor(timestampMs / 1000 / 30) + stepOffset;
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
  const hmac = new Uint8Array(signature);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return String(otp).padStart(6, '0');
}

export async function verifyTotpCode(
  secret: string,
  userCode: string,
  toleranceSteps = 1,
  timestampMs = Date.now()
): Promise<boolean> {
  const cleanCode = (userCode || '').replace(/\D/g, '');
  if (cleanCode.length !== 6) return false;

  const cleanSecret = normalizeBase32(secret);
  if (cleanSecret.length < 16) return false;

  for (let offset = -toleranceSteps; offset <= toleranceSteps; offset++) {
    const expected = await generateTotpCode(cleanSecret, timestampMs, offset);
    if (expected === cleanCode) {
      return true;
    }
  }
  return false;
}

export function getTotpSecondsRemaining(timestampMs = Date.now()): number {
  const elapsed = Math.floor(timestampMs / 1000) % 30;
  return 30 - elapsed;
}
