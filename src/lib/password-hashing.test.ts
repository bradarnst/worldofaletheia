import { describe, expect, it } from 'vitest';
import { constantTimeEqual, hashPassword, verifyPassword } from './password-hashing';

const testEnv = {
  PASSWORD_HASH_PEPPER: 'test-pepper',
  PASSWORD_HASH_ITERATIONS: '2',
};

describe('password hashing', () => {
  it('hashes and verifies a password with the versioned format', async () => {
    const hash = await hashPassword('correct horse battery staple', testEnv);

    expect(hash).toMatch(
      /^woa-pbkdf2-sha256-v1:2:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/,
    );
    await expect(
      verifyPassword({ hash, password: 'correct horse battery staple' }, testEnv),
    ).resolves.toBe(true);
  });

  it('normalizes passwords with NFKC before deriving the key', async () => {
    const hash = await hashPassword('\u212Bletheia', testEnv);

    await expect(verifyPassword({ hash, password: '\u00C5letheia' }, testEnv)).resolves.toBe(true);
  });

  it('returns false for the wrong password', async () => {
    const hash = await hashPassword('correct password', testEnv);

    await expect(verifyPassword({ hash, password: 'wrong password' }, testEnv)).resolves.toBe(false);
  });

  it('fails closed for malformed and unsupported hash formats', async () => {
    await expect(verifyPassword({ hash: 'not-a-supported-hash', password: 'password' }, testEnv)).resolves.toBe(
      false,
    );
    await expect(
      verifyPassword({ hash: 'woa-pbkdf2-sha256-v2:2:salt:key', password: 'password' }, testEnv),
    ).resolves.toBe(false);
    await expect(
      verifyPassword({ hash: 'woa-pbkdf2-sha256-v1:not-number:salt:key', password: 'password' }, testEnv),
    ).resolves.toBe(false);
  });

  it('uses the per-hash iteration count during verification', async () => {
    const oneIterationHash = await hashPassword('password', {
      ...testEnv,
      PASSWORD_HASH_ITERATIONS: '1',
    });
    const twoIterationHash = await hashPassword('password', {
      ...testEnv,
      PASSWORD_HASH_ITERATIONS: '2',
    });

    expect(oneIterationHash.split(':')[1]).toBe('1');
    expect(twoIterationHash.split(':')[1]).toBe('2');
    await expect(verifyPassword({ hash: oneIterationHash, password: 'password' }, testEnv)).resolves.toBe(
      true,
    );
    await expect(verifyPassword({ hash: twoIterationHash, password: 'password' }, testEnv)).resolves.toBe(
      true,
    );
  });

  it('compares byte arrays without early equality shortcuts', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([9, 2, 3]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });

  it('requires PASSWORD_HASH_PEPPER for hashing and verification', async () => {
    const hash = await hashPassword('password', testEnv);
    const envWithoutPepper = { PASSWORD_HASH_ITERATIONS: '2' };

    await expect(hashPassword('password', envWithoutPepper)).rejects.toThrow(
      'PASSWORD_HASH_PEPPER',
    );
    await expect(verifyPassword({ hash, password: 'password' }, envWithoutPepper)).rejects.toThrow(
      'PASSWORD_HASH_PEPPER',
    );
  });
});
