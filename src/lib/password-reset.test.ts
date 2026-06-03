import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1DatabaseLike, D1PreparedStatementLike } from '~/lib/d1';
import {
  PASSWORD_RESET_GENERIC_MESSAGE,
  completePasswordReset,
  requestPasswordReset,
} from '~/lib/password-reset';
import { buildPasswordResetIdentifier, hashPasswordResetToken } from '~/lib/password-reset-tokens';
import { verifyPassword } from '~/lib/password-hashing';

interface UserRow {
  id: string;
  email: string;
  email_canonical?: string | null;
}

interface AccountRow {
  id: string;
  providerId: string;
  userId: string;
  password?: string | null;
  updatedAt?: string;
}

interface VerificationRow {
  id: string;
  identifier: string;
  value: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: string;
  userId: string;
}

class FakeStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(
    private readonly db: FakeD1Database,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const results = await this.all<T>();
    return results.results[0] ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: this.db.select(this.query, this.values) as T[] };
  }

  async run(): Promise<unknown> {
    this.db.execute(this.query, this.values);
    return { success: true };
  }

  runSync(): void {
    this.db.execute(this.query, this.values);
  }
}

class FakeD1Database implements D1DatabaseLike {
  users: UserRow[] = [];
  accounts: AccountRow[] = [];
  verifications: VerificationRow[] = [];
  sessions: SessionRow[] = [];

  prepare(query: string): D1PreparedStatementLike {
    return new FakeStatement(this, query);
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> {
    const snapshot = {
      users: structuredClone(this.users),
      accounts: structuredClone(this.accounts),
      verifications: structuredClone(this.verifications),
      sessions: structuredClone(this.sessions),
    };

    try {
      for (const statement of statements) {
        (statement as FakeStatement).runSync();
      }
    } catch (error) {
      this.users = snapshot.users;
      this.accounts = snapshot.accounts;
      this.verifications = snapshot.verifications;
      this.sessions = snapshot.sessions;
      throw error;
    }

    return statements.map(() => ({ success: true }));
  }

  select(query: string, values: unknown[]): unknown[] {
    if (query.includes('FROM "user" WHERE email_canonical = ?')) {
      const email = String(values[0]);
      return this.users.filter((user) => user.email_canonical === email);
    }

    if (query.includes('FROM verification WHERE identifier = ? AND value = ?')) {
      const identifier = String(values[0]);
      const value = String(values[1]);
      const now = String(values[2]);
      return this.verifications.filter((row) => row.identifier === identifier && row.value === value && row.expiresAt > now).slice(0, 1);
    }

    if (query.includes("FROM account WHERE providerId = 'credential'")) {
      const userId = String(values[0]);
      return this.accounts.filter((account) => account.providerId === 'credential' && account.userId === userId);
    }

    if (query.includes('FROM verification WHERE value = ?')) {
      const value = String(values[0]);
      return this.verifications.filter((row) => row.value === value);
    }

    if (query.includes('FROM "user" WHERE id = ?')) {
      const userId = String(values[0]);
      return this.users.filter((user) => user.id === userId);
    }

    throw new Error(`Unhandled fake select query: ${query}`);
  }

  execute(query: string, values: unknown[]): void {
    if (query.startsWith('DELETE FROM verification WHERE identifier = ?')) {
      const identifier = String(values[0]);
      this.verifications = this.verifications.filter((row) => row.identifier !== identifier);
      return;
    }

    if (query.startsWith('DELETE FROM verification WHERE (identifier LIKE ? OR identifier LIKE ?)')) {
      const emailPrefix = String(values[0]).replace('%', '');
      const ipPrefix = String(values[1]).replace('%', '');
      const now = String(values[2]);
      this.verifications = this.verifications.filter(
        (row) =>
          !(
            (row.identifier.startsWith(emailPrefix) || row.identifier.startsWith(ipPrefix)) &&
            row.expiresAt <= now
          ),
      );
      return;
    }

    if (query.startsWith('DELETE FROM verification WHERE id = ?')) {
      const id = String(values[0]);
      this.verifications = this.verifications.filter((row) => row.id !== id);
      return;
    }

    if (query.startsWith('INSERT INTO verification')) {
      const [id, identifier, value, expiresAt, createdAt, updatedAt] = values.map(String);
      this.verifications.push({ id, identifier, value, expiresAt, createdAt, updatedAt });
      return;
    }

    if (query.startsWith('UPDATE account SET password')) {
      const [password, updatedAt, accountId, userId] = values.map(String);
      const account = this.accounts.find(
        (row) => row.id === accountId && row.providerId === 'credential' && row.userId === userId,
      );
      if (account) {
        account.password = password;
        account.updatedAt = updatedAt;
      }
      return;
    }

    if (query.startsWith('DELETE FROM session WHERE userId = ?')) {
      const userId = String(values[0]);
      this.sessions = this.sessions.filter((session) => session.userId !== userId);
      return;
    }

    throw new Error(`Unhandled fake execute query: ${query}`);
  }
}

const env = {
  PASSWORD_HASH_PEPPER: 'test-pepper',
  PASSWORD_HASH_ITERATIONS: '1000',
};

function createCredentialDb(): FakeD1Database {
  const db = new FakeD1Database();
  db.users.push({ id: 'user-1', email: 'User@Example.com', email_canonical: 'user@example.com' });
  db.accounts.push({ id: 'account-1', providerId: 'credential', userId: 'user-1', password: 'old' });
  db.sessions.push({ id: 'session-1', userId: 'user-1' }, { id: 'session-2', userId: 'user-1' });
  return db;
}

function getPasswordResetRows(db: FakeD1Database): VerificationRow[] {
  return db.verifications.filter((row) => row.identifier.startsWith('password-reset:user-'));
}

describe('password reset request flow', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns generic success for known, unknown, and no-credential accounts', async () => {
    const knownDb = createCredentialDb();
    const sendEmail = vi.fn(async () => undefined);
    await expect(
      requestPasswordReset({ db: knownDb, env, email: ' user@example.com ', origin: 'https://example.test', sendEmail }),
    ).resolves.toEqual({ ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE });

    const unknownDb = createCredentialDb();
    const unknownSend = vi.fn(async () => undefined);
    await expect(
      requestPasswordReset({ db: unknownDb, env, email: 'missing@example.com', origin: 'https://example.test', sendEmail: unknownSend }),
    ).resolves.toEqual({ ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE });
    expect(unknownSend).not.toHaveBeenCalled();

    const googleOnlyDb = new FakeD1Database();
    googleOnlyDb.users.push({ id: 'user-2', email: 'google@example.com', email_canonical: 'google@example.com' });
    googleOnlyDb.accounts.push({ id: 'google-1', providerId: 'google', userId: 'user-2' });
    const googleOnlySend = vi.fn(async () => undefined);
    await expect(
      requestPasswordReset({ db: googleOnlyDb, env, email: 'google@example.com', origin: 'https://example.test', sendEmail: googleOnlySend }),
    ).resolves.toEqual({ ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE });
    expect(googleOnlySend).not.toHaveBeenCalled();
  });

  it('stores only a hashed token and sends a reset URL', async () => {
    const db = createCredentialDb();
    let rawToken = '';
    const sendEmail = vi.fn(async (input: { resetUrl: string }) => {
      rawToken = new URL(input.resetUrl).searchParams.get('token') ?? '';
    });

    await requestPasswordReset({ db, env, email: 'user@example.com', origin: 'https://example.test', sendEmail });

    const resetRows = getPasswordResetRows(db);
    expect(resetRows).toHaveLength(1);
    expect(rawToken).toHaveLength(43);
    expect(resetRows[0].value).not.toBe(rawToken);
    expect(resetRows[0].value).toBe(await hashPasswordResetToken(rawToken));
    expect(resetRows[0].identifier).toBe(buildPasswordResetIdentifier('user-1'));
  });

  it('uses the trusted configured origin for reset links', async () => {
    const db = createCredentialDb();
    let resetUrl = '';
    const sendEmail = vi.fn(async (input: { resetUrl: string }) => {
      resetUrl = input.resetUrl;
    });

    await requestPasswordReset({
      db,
      env: { ...env, BETTER_AUTH_URL: 'https://worldofaletheia.com' },
      email: 'user@example.com',
      origin: 'https://attacker.example',
      sendEmail,
    });

    expect(new URL(resetUrl).origin).toBe('https://worldofaletheia.com');
  });

  it('rate limits repeat requests before replacing active tokens or sending email', async () => {
    const db = createCredentialDb();
    const sendEmail = vi.fn(async () => undefined);

    await requestPasswordReset({ db, env, email: 'user@example.com', origin: 'https://example.test', clientIp: '203.0.113.10', sendEmail });
    const firstResetRows = getPasswordResetRows(db);

    await requestPasswordReset({ db, env, email: 'user@example.com', origin: 'https://example.test', clientIp: '203.0.113.10', sendEmail });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(getPasswordResetRows(db)).toEqual(firstResetRows);
  });

  it('replaces previous reset tokens for the same user', async () => {
    const db = createCredentialDb();
    db.verifications.push({
      id: 'old-token',
      identifier: buildPasswordResetIdentifier('user-1'),
      value: 'old-hash',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await requestPasswordReset({ db, env, email: 'user@example.com', origin: 'https://example.test', sendEmail: vi.fn(async () => undefined) });

    const resetRows = getPasswordResetRows(db);
    expect(resetRows).toHaveLength(1);
    expect(resetRows[0].id).not.toBe('old-token');
  });

  it('cleans up the inserted token and logs sanitized output when email send fails', async () => {
    const db = createCredentialDb();
    const sensitiveToken = 'abcdefghijklmnopqrstuvwxyzABCDE_0123456789-abc';

    await requestPasswordReset({
      db,
      env,
      email: 'user@example.com',
      origin: 'https://example.test',
      sendEmail: vi.fn(async () => {
        throw new Error(`failed ${sensitiveToken}`);
      }),
    });

    expect(getPasswordResetRows(db)).toHaveLength(0);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(sensitiveToken);
  });
});

describe('password reset completion flow', () => {
  it('updates the existing credential with an ADR-0023 hash, deletes token, and revokes sessions', async () => {
    const db = createCredentialDb();
    const token = 'abcdefghijklmnopqrstuvwxyzABCDE_0123456789-abc';
    db.verifications.push({
      id: 'verification-1',
      identifier: buildPasswordResetIdentifier('user-1'),
      value: await hashPasswordResetToken(token),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await completePasswordReset({
      db,
      env,
      token,
      newPassword: 'Correct Horse Battery Staple',
      confirmPassword: 'Correct Horse Battery Staple',
    });

    expect(result.ok).toBe(true);
    expect(db.accounts[0].password?.startsWith('woa-pbkdf2-sha256-v1:1000:')).toBe(true);
    await expect(verifyPassword({ hash: db.accounts[0].password ?? '', password: 'Correct Horse Battery Staple' }, env)).resolves.toBe(true);
    expect(db.verifications).toHaveLength(0);
    expect(db.sessions).toHaveLength(0);
  });

  it('fails closed for expired, invalid, and reused tokens', async () => {
    const expiredDb = createCredentialDb();
    const expiredToken = 'abcdefghijklmnopqrstuvwxyzABCDE_0123456789-exp';
    expiredDb.verifications.push({
      id: 'expired',
      identifier: buildPasswordResetIdentifier('user-1'),
      value: await hashPasswordResetToken(expiredToken),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      completePasswordReset({ db: expiredDb, env, token: expiredToken, newPassword: 'newpassword1', confirmPassword: 'newpassword1' }),
    ).resolves.toMatchObject({ ok: false });
    expect(expiredDb.accounts[0].password).toBe('old');

    const invalidDb = createCredentialDb();
    await expect(
      completePasswordReset({ db: invalidDb, env, token: 'not valid', newPassword: 'newpassword1', confirmPassword: 'newpassword1' }),
    ).resolves.toMatchObject({ ok: false });

    const reusedDb = createCredentialDb();
    const reusedToken = 'abcdefghijklmnopqrstuvwxyzABCDE_0123456789-use';
    reusedDb.verifications.push({
      id: 'reused',
      identifier: buildPasswordResetIdentifier('user-1'),
      value: await hashPasswordResetToken(reusedToken),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      completePasswordReset({ db: reusedDb, env, token: reusedToken, newPassword: 'newpassword1', confirmPassword: 'newpassword1' }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      completePasswordReset({ db: reusedDb, env, token: reusedToken, newPassword: 'anotherpassword', confirmPassword: 'anotherpassword' }),
    ).resolves.toMatchObject({ ok: false });
  });

  it('fails closed for duplicate token state and duplicate credentials', async () => {
    const duplicateTokenDb = createCredentialDb();
    const token = 'abcdefghijklmnopqrstuvwxyzABCDE_0123456789-dup';
    const value = await hashPasswordResetToken(token);
    duplicateTokenDb.verifications.push(
      {
        id: 'one',
        identifier: buildPasswordResetIdentifier('user-1'),
        value,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'two',
        identifier: buildPasswordResetIdentifier('user-1'),
        value,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    );

    await expect(
      completePasswordReset({ db: duplicateTokenDb, env, token, newPassword: 'newpassword1', confirmPassword: 'newpassword1' }),
    ).resolves.toMatchObject({ ok: false });

    const duplicateCredentialDb = createCredentialDb();
    const credentialToken = 'abcdefghijklmnopqrstuvwxyzABCDE_0123456789-crd';
    duplicateCredentialDb.accounts.push({ id: 'account-2', providerId: 'credential', userId: 'user-1', password: 'old2' });
    duplicateCredentialDb.verifications.push({
      id: 'verification-credential',
      identifier: buildPasswordResetIdentifier('user-1'),
      value: await hashPasswordResetToken(credentialToken),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      completePasswordReset({ db: duplicateCredentialDb, env, token: credentialToken, newPassword: 'newpassword1', confirmPassword: 'newpassword1' }),
    ).resolves.toMatchObject({ ok: false });
  });
});
