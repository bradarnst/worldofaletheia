import { describe, expect, it } from 'vitest';
import {
  PASSWORD_RESET_EXPIRY_MINUTES,
  buildPasswordResetIdentifier,
  createPasswordResetToken,
  getPasswordResetExpiry,
  hashPasswordResetToken,
  isPlausiblePasswordResetToken,
} from '~/lib/password-reset-tokens';

describe('password reset token helpers', () => {
  it('generates base64url-safe 32-byte reset tokens', () => {
    const token = createPasswordResetToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).toHaveLength(43);
    expect(isPlausiblePasswordResetToken(token)).toBe(true);
  });

  it('hashes tokens deterministically with purpose scoping', async () => {
    const token = 'abcdefghijklmnopqrstuvwxyzABCDE_0123456789-abc';
    const first = await hashPasswordResetToken(token);
    const second = await hashPasswordResetToken(token);

    expect(first).toBe(second);
    expect(first).not.toBe(token);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('builds identifiers and 30-minute expiries', () => {
    const now = new Date('2026-06-02T12:00:00.000Z');
    const expiry = new Date(getPasswordResetExpiry(now));

    expect(buildPasswordResetIdentifier('user-1')).toBe('password-reset:user-1');
    expect(expiry.getTime() - now.getTime()).toBe(PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);
  });
});
