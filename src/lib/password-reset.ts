import type { D1DatabaseLike } from '~/lib/d1';
import { sendPasswordResetEmail } from '~/lib/email';
import { hashPassword } from '~/lib/password-hashing';
import {
  PASSWORD_RESET_EXPIRY_MINUTES,
  buildPasswordResetIdentifier,
  createPasswordResetToken,
  getPasswordResetExpiry,
  getUserIdFromPasswordResetIdentifier,
  hashPasswordResetToken,
  isPlausiblePasswordResetToken,
} from '~/lib/password-reset-tokens';

export const PASSWORD_RESET_GENERIC_MESSAGE =
  'If an account exists for that email, we’ll send password reset instructions.';
export const PASSWORD_RESET_EXPIRED_MESSAGE =
  'This reset link is invalid or expired. Request a new password reset link.';
export const PASSWORD_RESET_COMPLETE_MESSAGE = 'Password reset complete. Sign in with your new password.';

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_RESET_EMAIL_RATE_LIMIT_MINUTES = 10;
const PASSWORD_RESET_IP_RATE_LIMIT_MINUTES = 1;
const PASSWORD_RESET_EMAIL_RATE_LIMIT_PREFIX = 'password-reset-rate:email:';
const PASSWORD_RESET_IP_RATE_LIMIT_PREFIX = 'password-reset-rate:ip:';
const RATE_LIMIT_VALUE = 'active';

interface UserRow {
  id: string;
  email: string;
  email_canonical?: string | null;
}

interface CredentialRow {
  id: string;
}

interface VerificationRow {
  id: string;
  identifier: string;
  value: string;
  expiresAt: string;
}

export interface PasswordResetRequestInput {
  db: D1DatabaseLike;
  env: Record<string, unknown>;
  email: string;
  origin?: string;
  clientIp?: string;
  requestId?: string;
  sendEmail?: typeof sendPasswordResetEmail;
}

export interface PasswordResetCompletionInput {
  db: D1DatabaseLike;
  env: Record<string, unknown>;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordResetResult {
  ok: boolean;
  message: string;
}

export function normalizeEmailForPasswordReset(email: string): string {
  return email.trim().toLowerCase();
}

function getNowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return crypto.randomUUID();
}

async function getUsersByCanonicalEmail(db: D1DatabaseLike, email: string): Promise<UserRow[]> {
  const result = await db.prepare('SELECT id, email, email_canonical FROM "user" WHERE email_canonical = ?').bind(email).all<UserRow>();
  return result.results;
}

async function getCredentialRows(db: D1DatabaseLike, userId: string): Promise<CredentialRow[]> {
  const result = await db
    .prepare("SELECT id FROM account WHERE providerId = 'credential' AND userId = ?")
    .bind(userId)
    .all<CredentialRow>();
  return result.results;
}

async function cleanupPasswordResetRows(db: D1DatabaseLike, identifier: string): Promise<void> {
  await db.prepare('DELETE FROM verification WHERE identifier = ?').bind(identifier).run();
}

async function deleteVerificationRow(db: D1DatabaseLike, id: string): Promise<void> {
  await db.prepare('DELETE FROM verification WHERE id = ?').bind(id).run();
}

async function insertPasswordResetRow(input: {
  db: D1DatabaseLike;
  id: string;
  identifier: string;
  value: string;
  expiresAt: string;
  now: string;
}): Promise<void> {
  await input.db
    .prepare('INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(input.id, input.identifier, input.value, input.expiresAt, input.now, input.now)
    .run();
}

function buildResetUrl(origin: string, rawToken: string): string {
  const url = new URL('/reset-password', origin);
  url.searchParams.set('token', rawToken);
  return url.toString();
}

function getTrustedResetOrigin(env: Record<string, unknown>, fallbackOrigin?: string): string {
  const configuredOrigin = env.BETTER_AUTH_URL;
  const origin = typeof configuredOrigin === 'string' && configuredOrigin.length > 0 ? configuredOrigin : fallbackOrigin;
  if (!origin) {
    throw new Error('BETTER_AUTH_URL is required for password reset links');
  }

  return new URL(origin).origin;
}

function getRateLimitExpiry(minutes: number, now = new Date()): string {
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

async function hashRateLimitKey(value: string): Promise<string> {
  return await hashPasswordResetToken(value);
}

async function cleanupExpiredPasswordResetRateLimits(db: D1DatabaseLike, now: string): Promise<void> {
  await db
    .prepare('DELETE FROM verification WHERE (identifier LIKE ? OR identifier LIKE ?) AND expiresAt <= ?')
    .bind(`${PASSWORD_RESET_EMAIL_RATE_LIMIT_PREFIX}%`, `${PASSWORD_RESET_IP_RATE_LIMIT_PREFIX}%`, now)
    .run();
}

async function hasActiveRateLimit(db: D1DatabaseLike, identifier: string, now: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM verification WHERE identifier = ? AND value = ? AND expiresAt > ? LIMIT 1')
    .bind(identifier, RATE_LIMIT_VALUE, now)
    .first<{ id: string }>();
  return row !== null;
}

async function insertRateLimitRow(input: {
  db: D1DatabaseLike;
  identifier: string;
  expiresAt: string;
  now: string;
}): Promise<void> {
  await input.db
    .prepare('INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(createId(), input.identifier, RATE_LIMIT_VALUE, input.expiresAt, input.now, input.now)
    .run();
}

async function reservePasswordResetRateLimit(input: {
  db: D1DatabaseLike;
  normalizedEmail: string;
  clientIp?: string;
  now: string;
}): Promise<boolean> {
  await cleanupExpiredPasswordResetRateLimits(input.db, input.now);

  const emailIdentifier = `${PASSWORD_RESET_EMAIL_RATE_LIMIT_PREFIX}${await hashRateLimitKey(input.normalizedEmail)}`;
  const identifiers = [{ identifier: emailIdentifier, minutes: PASSWORD_RESET_EMAIL_RATE_LIMIT_MINUTES }];

  const normalizedIp = input.clientIp?.trim();
  if (normalizedIp) {
    identifiers.push({
      identifier: `${PASSWORD_RESET_IP_RATE_LIMIT_PREFIX}${await hashRateLimitKey(normalizedIp)}`,
      minutes: PASSWORD_RESET_IP_RATE_LIMIT_MINUTES,
    });
  }

  for (const { identifier } of identifiers) {
    if (await hasActiveRateLimit(input.db, identifier, input.now)) {
      return false;
    }
  }

  try {
    for (const { identifier, minutes } of identifiers) {
      await insertRateLimitRow({
        db: input.db,
        identifier,
        expiresAt: getRateLimitExpiry(minutes),
        now: input.now,
      });
    }
  } catch {
    return false;
  }

  return true;
}

export async function requestPasswordReset(input: PasswordResetRequestInput): Promise<PasswordResetResult> {
  const requestId = input.requestId ?? createId();
  const normalizedEmail = normalizeEmailForPasswordReset(input.email);
  if (normalizedEmail.length === 0) {
    return { ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  try {
    const now = getNowIso();
    const isRateLimitReserved = await reservePasswordResetRateLimit({
      db: input.db,
      normalizedEmail,
      clientIp: input.clientIp,
      now,
    });
    if (!isRateLimitReserved) {
      return { ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    const users = await getUsersByCanonicalEmail(input.db, normalizedEmail);
    if (users.length !== 1) {
      if (users.length > 1) {
        console.warn('password_reset.request.skipped', { requestId, reason: 'duplicate_email' });
      }
      return { ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    const [user] = users;
    const credentialRows = await getCredentialRows(input.db, user.id);
    if (credentialRows.length !== 1) {
      if (credentialRows.length > 1) {
        console.warn('password_reset.request.skipped', { requestId, reason: 'duplicate_credential' });
      }
      return { ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    const rawToken = createPasswordResetToken();
    const hashedToken = await hashPasswordResetToken(rawToken);
    const identifier = buildPasswordResetIdentifier(user.id);
    const verificationId = createId();

    await cleanupPasswordResetRows(input.db, identifier);
    await insertPasswordResetRow({
      db: input.db,
      id: verificationId,
      identifier,
      value: hashedToken,
      expiresAt: getPasswordResetExpiry(),
      now,
    });

    try {
      await (input.sendEmail ?? sendPasswordResetEmail)({
        env: input.env,
        email: user.email,
        resetUrl: buildResetUrl(getTrustedResetOrigin(input.env, input.origin), rawToken),
        expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
        requestId,
      });
    } catch {
      await deleteVerificationRow(input.db, verificationId);
      console.error('password_reset.request.email_failed', { requestId, reason: 'relay_failed' });
    }
  } catch {
    console.error('password_reset.request.failed', { requestId, reason: 'internal_error' });
  }

  return { ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
}

async function getVerificationRowsByValue(db: D1DatabaseLike, hashedToken: string): Promise<VerificationRow[]> {
  const result = await db
    .prepare('SELECT id, identifier, value, expiresAt FROM verification WHERE value = ?')
    .bind(hashedToken)
    .all<VerificationRow>();
  return result.results;
}

async function getUserById(db: D1DatabaseLike, userId: string): Promise<UserRow | null> {
  return await db.prepare('SELECT id, email, email_canonical FROM "user" WHERE id = ?').bind(userId).first<UserRow>();
}

async function completePasswordResetTransaction(input: {
  db: D1DatabaseLike;
  accountId: string;
  userId: string;
  verificationId: string;
  passwordHash: string;
  now: string;
}): Promise<void> {
  if (typeof input.db.batch !== 'function') {
    throw new Error('D1 batch support is required for atomic password reset completion');
  }

  await input.db.batch([
    input.db
      .prepare("UPDATE account SET password = ?, updatedAt = ? WHERE id = ? AND providerId = 'credential' AND userId = ?")
      .bind(input.passwordHash, input.now, input.accountId, input.userId),
    input.db.prepare('DELETE FROM verification WHERE id = ?').bind(input.verificationId),
    input.db.prepare('DELETE FROM session WHERE userId = ?').bind(input.userId),
  ]);
}

function isExpired(expiresAt: string): boolean {
  const expiryTime = Date.parse(expiresAt);
  return !Number.isFinite(expiryTime) || expiryTime <= Date.now();
}

export async function completePasswordReset(input: PasswordResetCompletionInput): Promise<PasswordResetResult> {
  if (!isPlausiblePasswordResetToken(input.token)) {
    return { ok: false, message: PASSWORD_RESET_EXPIRED_MESSAGE };
  }

  if (input.newPassword.length < MIN_PASSWORD_LENGTH || input.newPassword !== input.confirmPassword) {
    return { ok: false, message: PASSWORD_RESET_EXPIRED_MESSAGE };
  }

  const hashedToken = await hashPasswordResetToken(input.token);
  const verificationRows = await getVerificationRowsByValue(input.db, hashedToken);
  if (verificationRows.length !== 1) {
    return { ok: false, message: PASSWORD_RESET_EXPIRED_MESSAGE };
  }

  const [verification] = verificationRows;
  if (isExpired(verification.expiresAt)) {
    await deleteVerificationRow(input.db, verification.id);
    return { ok: false, message: PASSWORD_RESET_EXPIRED_MESSAGE };
  }

  const userId = getUserIdFromPasswordResetIdentifier(verification.identifier);
  if (!userId) {
    return { ok: false, message: PASSWORD_RESET_EXPIRED_MESSAGE };
  }

  const user = await getUserById(input.db, userId);
  if (!user) {
    return { ok: false, message: PASSWORD_RESET_EXPIRED_MESSAGE };
  }

  const credentialRows = await getCredentialRows(input.db, userId);
  if (credentialRows.length !== 1) {
    return { ok: false, message: PASSWORD_RESET_EXPIRED_MESSAGE };
  }

  const passwordHash = await hashPassword(input.newPassword, input.env);
  const now = getNowIso();
  await completePasswordResetTransaction({
    db: input.db,
    accountId: credentialRows[0].id,
    userId,
    verificationId: verification.id,
    passwordHash,
    now,
  });

  return { ok: true, message: PASSWORD_RESET_COMPLETE_MESSAGE };
}

export async function isPasswordResetTokenCurrentlyValid(db: D1DatabaseLike, token: string): Promise<boolean> {
  if (!isPlausiblePasswordResetToken(token)) {
    return false;
  }

  const hashedToken = await hashPasswordResetToken(token);
  const verificationRows = await getVerificationRowsByValue(db, hashedToken);
  if (verificationRows.length !== 1) {
    return false;
  }

  const [verification] = verificationRows;
  return !isExpired(verification.expiresAt) && getUserIdFromPasswordResetIdentifier(verification.identifier) !== null;
}
