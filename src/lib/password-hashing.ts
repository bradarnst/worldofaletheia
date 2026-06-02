const HASH_PREFIX = 'woa-pbkdf2-sha256-v1';
const DEFAULT_ITERATIONS = 100_000;
const MAX_ITERATIONS = 1_000_000;
const SALT_BYTES = 32;
const KEY_BITS = 256;
const KEY_BYTES = KEY_BITS / 8;

const textEncoder = new TextEncoder();

interface ParsedPasswordHash {
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  derivedKey: Uint8Array<ArrayBuffer>;
}

export interface VerifyPasswordInput {
  hash: string;
  password: string;
}

function getRequiredPepper(env: Record<string, unknown>): string {
  const pepper = env.PASSWORD_HASH_PEPPER;
  if (typeof pepper !== 'string' || pepper.length === 0) {
    throw new Error('Missing required password hashing environment variable: PASSWORD_HASH_PEPPER');
  }

  return pepper;
}

function getIterations(env: Record<string, unknown>): number {
  const configured = env.PASSWORD_HASH_ITERATIONS;
  if (configured === undefined) {
    return DEFAULT_ITERATIONS;
  }

  if (typeof configured !== 'string' || configured.trim().length === 0) {
    throw new Error('PASSWORD_HASH_ITERATIONS must be a positive integer when provided');
  }

  const iterations = Number(configured);
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || iterations > MAX_ITERATIONS) {
    throw new Error('PASSWORD_HASH_ITERATIONS must be a positive integer within the supported range');
  }

  return iterations;
}

function normalizePasswordMaterial(password: string, pepper: string): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(`${password.normalize('NFKC')}\0${pepper}`);
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function parseStoredHash(hash: string): ParsedPasswordHash | null {
  const parts = hash.split(':');
  if (parts.length !== 4 || parts[0] !== HASH_PREFIX) {
    return null;
  }

  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || iterations > MAX_ITERATIONS) {
    return null;
  }

  const salt = decodeBase64Url(parts[2]);
  const derivedKey = decodeBase64Url(parts[3]);
  if (!salt || salt.length !== SALT_BYTES || !derivedKey || derivedKey.length !== KEY_BYTES) {
    return null;
  }

  return {
    iterations,
    salt,
    derivedKey,
  };
}

async function derivePasswordKey(input: {
  password: string;
  pepper: string;
  salt: Uint8Array<ArrayBuffer>;
  iterations: number;
}): Promise<Uint8Array<ArrayBuffer>> {
  const importedKey = await crypto.subtle.importKey(
    'raw',
    normalizePasswordMaterial(input.password, input.pepper),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: input.salt,
      iterations: input.iterations,
    },
    importedKey,
    KEY_BITS,
  );

  return new Uint8Array(derivedBits);
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    const leftByte = index < left.length ? left[index] : 0;
    const rightByte = index < right.length ? right[index] : 0;
    difference |= leftByte ^ rightByte;
  }

  return difference === 0;
}

export async function hashPassword(password: string, env: Record<string, unknown>): Promise<string> {
  const pepper = getRequiredPepper(env);
  const iterations = getIterations(env);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derivedKey = await derivePasswordKey({ password, pepper, salt, iterations });

  return `${HASH_PREFIX}:${iterations}:${encodeBase64Url(salt)}:${encodeBase64Url(derivedKey)}`;
}

export async function verifyPassword(
  input: VerifyPasswordInput,
  env: Record<string, unknown>,
): Promise<boolean> {
  const pepper = getRequiredPepper(env);
  const parsedHash = parseStoredHash(input.hash);
  if (!parsedHash) {
    return false;
  }

  const candidateKey = await derivePasswordKey({
    password: input.password,
    pepper,
    salt: parsedHash.salt,
    iterations: parsedHash.iterations,
  });

  return constantTimeEqual(candidateKey, parsedHash.derivedKey);
}
