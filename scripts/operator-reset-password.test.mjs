import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../src/lib/password-hashing.ts';
import {
  HASH_PREFIX,
  buildCredentialWriteSql,
  buildLookupSql,
  getSanitizedPlan,
  getWranglerD1Args,
  hashPasswordForOperator,
  parseArgs,
  renderSanitizedPlan,
  validateOptions,
} from './operator-reset-password.mjs';

describe('operator password reset script helpers', () => {
  it('parses target environment and email/user-id arguments', () => {
    expect(parseArgs(['--env', 'staging', '--email', 'User@Example.COM', '--dry-run'])).toEqual({
      env: 'staging',
      email: 'User@Example.COM',
      userId: undefined,
      dryRun: true,
      revokeSessions: false,
      createCredential: false,
      yes: false,
    });

    expect(parseArgs(['--env', 'prod', '--user-id', 'user-123', '--revoke-sessions', '--yes'])).toMatchObject({
      env: 'prod',
      userId: 'user-123',
      revokeSessions: true,
      yes: true,
    });
  });

  it('fails closed for invalid env, ambiguous target, and missing pepper', () => {
    expect(() => validateOptions({ env: 'qa', email: 'a@example.com' }, { PASSWORD_HASH_PEPPER: 'pepper' })).toThrow('--env');
    expect(() => validateOptions({ env: 'local', email: 'a@example.com', userId: 'user-1' }, { PASSWORD_HASH_PEPPER: 'pepper' })).toThrow('exactly one');
    expect(() => validateOptions({ env: 'local', email: 'a@example.com' }, {})).toThrow('PASSWORD_HASH_PEPPER');
  });

  it('maps local, staging, and prod to Wrangler D1 execution flags', () => {
    expect(getWranglerD1Args('local', './op.sql')).toEqual(['d1', 'execute', 'DB', '--local', '--file', './op.sql']);
    expect(getWranglerD1Args('staging', './op.sql')).toEqual(['d1', 'execute', 'DB', '--remote', '--env', 'staging', '--file', './op.sql']);
    expect(getWranglerD1Args('prod', './op.sql')).toEqual(['d1', 'execute', 'DB', '--remote', '--file', './op.sql']);
  });

  it('builds canonical email and user-id lookup SQL', () => {
    expect(buildLookupSql({ email: ' User@Example.COM ' })).toContain("COALESCE(email_canonical, lower(trim(email))) = 'user@example.com'");
    expect(buildLookupSql({ userId: "user'1" })).toContain("id = 'user''1'");
  });

  it('generates ADR-0023-compatible PBKDF2 hashes', async () => {
    const env = { PASSWORD_HASH_PEPPER: 'test-pepper' };
    const hash = await hashPasswordForOperator('Correct Horse Battery Staple', env);

    expect(hash.startsWith(`${HASH_PREFIX}:100000:`)).toBe(true);
    await expect(verifyPassword({ hash, password: 'Correct Horse Battery Staple' }, env)).resolves.toBe(true);
    await expect(verifyPassword({ hash, password: 'wrong password' }, env)).resolves.toBe(false);
  });

  it('builds update SQL and revokes sessions only when requested', () => {
    const sql = buildCredentialWriteSql({
      userId: 'user-1',
      existingCredentialId: 'account-1',
      passwordHash: `${HASH_PREFIX}:100000:salt:key`,
      revokeSessions: true,
    });

    expect(sql).toContain("UPDATE account SET password = 'woa-pbkdf2-sha256-v1:100000:salt:key'");
    expect(sql).toContain("WHERE id = 'account-1' AND providerId = 'credential' AND userId = 'user-1'");
    expect(sql).toContain("DELETE FROM session WHERE userId = 'user-1'");

    const withoutRevocation = buildCredentialWriteSql({
      userId: 'user-1',
      existingCredentialId: 'account-1',
      passwordHash: `${HASH_PREFIX}:100000:salt:key`,
      revokeSessions: false,
    });
    expect(withoutRevocation).not.toContain('DELETE FROM session');
  });

  it('builds create SQL only for explicit create path', () => {
    const sql = buildCredentialWriteSql({
      userId: 'user-1',
      newAccountRowId: 'credential-row-1',
      passwordHash: `${HASH_PREFIX}:100000:salt:key`,
      revokeSessions: false,
    });

    expect(sql).toContain('INSERT INTO account');
    expect(sql).toContain("'credential-row-1', 'user-1', 'credential', 'user-1'");
    expect(sql).not.toContain('DELETE FROM session');
  });

  it('renders dry-run output without password material or full hashes', () => {
    const fullHash = `${HASH_PREFIX}:100000:private-salt:private-derived-key`;
    const plan = getSanitizedPlan({
      environment: 'staging',
      target: 'email',
      userId: 'user-1',
      email: 'user@example.com',
      credentialAction: 'update',
      revokeSessions: true,
      dryRun: true,
    });
    const output = renderSanitizedPlan(plan);

    expect(output).toContain(HASH_PREFIX);
    expect(output).not.toContain(fullHash);
    expect(output).not.toContain('private-salt');
    expect(output).not.toContain('private-derived-key');
    expect(output).not.toContain('test-pepper');
  });
});
