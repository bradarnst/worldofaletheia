export const PASSWORD_RESET_IDENTIFIER_PREFIX = 'password-reset:';
export const PASSWORD_RESET_TOKEN_PURPOSE = 'woa-password-reset-v1';
export const PASSWORD_RESET_TOKEN_BYTES = 32;
export const PASSWORD_RESET_EXPIRY_MINUTES = 30;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const textEncoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function createPasswordResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_RESET_TOKEN_BYTES));
  return encodeBase64Url(bytes);
}

export function isPlausiblePasswordResetToken(token: string): boolean {
  return token.length >= 40 && token.length <= 64 && BASE64URL_PATTERN.test(token);
}

export async function hashPasswordResetToken(token: string): Promise<string> {
  const material = textEncoder.encode(`${PASSWORD_RESET_TOKEN_PURPOSE}\0${token}`);
  const digest = await crypto.subtle.digest('SHA-256', material);
  return encodeBase64Url(new Uint8Array(digest));
}

export function buildPasswordResetIdentifier(userId: string): string {
  return `${PASSWORD_RESET_IDENTIFIER_PREFIX}${userId}`;
}

export function getPasswordResetExpiry(now = new Date()): string {
  return new Date(now.getTime() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000).toISOString();
}

export function getUserIdFromPasswordResetIdentifier(identifier: string): string | null {
  if (!identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX)) {
    return null;
  }

  const userId = identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length);
  return userId.length > 0 ? userId : null;
}
