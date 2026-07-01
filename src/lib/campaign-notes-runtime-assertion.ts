import { getCloudflareRuntimeEnv } from '@utils/cloudflare-env';
import type { CampaignNotesRuntimeActorAssertion } from '@adapters/campaign-notes-api';

const ASSERTION_TTL_MS = 5 * 60 * 1000;
const SECRET_ENV_NAME = 'CAMPAIGN_NOTES_RUNTIME_ASSERTION_SECRET';
const ENVIRONMENT_ENV_NAME = 'CAMPAIGN_NOTES_ENVIRONMENT';

const textEncoder = new TextEncoder();

export type CampaignNotesAssertionEnvironment = 'staging' | 'production';
export type CampaignNotesRuntimeRole = 'member' | 'gm';

export interface CampaignNotesRuntimeActorPayload {
  userId: string;
  campaignSlug: string;
  role: CampaignNotesRuntimeRole;
  environment: CampaignNotesAssertionEnvironment;
  issuedAt: string;
  expiresAt: string;
}

interface CreateCampaignNotesRuntimeActorAssertionInput {
  userId: string;
  campaignSlug: string;
  role: CampaignNotesRuntimeRole;
  env?: Record<string, unknown>;
  now?: Date;
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

function encodeBase64UrlText(value: string): string {
  return encodeBase64Url(textEncoder.encode(value));
}

function normalizeEnvironment(value: unknown): CampaignNotesAssertionEnvironment | null {
  return value === 'staging' || value === 'production' ? value : null;
}

function readNonEmptyString(env: Record<string, unknown>, key: string): string | null {
  const value = env[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readImportMetaEnv(): Record<string, unknown> {
  return import.meta.env as Record<string, unknown>;
}

async function resolveRuntimeAssertionEnv(overrides?: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (overrides) {
    return overrides;
  }

  const runtimeEnv = await getCloudflareRuntimeEnv();
  return runtimeEnv ?? readImportMetaEnv();
}

async function signActorHeader(actor: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(actor));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function createCampaignNotesRuntimeActorAssertion(
  input: CreateCampaignNotesRuntimeActorAssertionInput,
): Promise<CampaignNotesRuntimeActorAssertion | null> {
  const env = await resolveRuntimeAssertionEnv(input.env);
  const secret = readNonEmptyString(env, SECRET_ENV_NAME);
  const environment = normalizeEnvironment(env[ENVIRONMENT_ENV_NAME]);

  if (!secret || !environment) {
    return null;
  }

  const issuedAtDate = input.now ?? new Date();
  if (Number.isNaN(issuedAtDate.getTime())) {
    return null;
  }

  const expiresAtDate = new Date(issuedAtDate.getTime() + ASSERTION_TTL_MS);
  if (expiresAtDate.getTime() <= issuedAtDate.getTime()) {
    return null;
  }

  const payload: CampaignNotesRuntimeActorPayload = {
    userId: input.userId,
    campaignSlug: input.campaignSlug,
    role: input.role,
    environment,
    issuedAt: issuedAtDate.toISOString(),
    expiresAt: expiresAtDate.toISOString(),
  };

  try {
    const actor = encodeBase64UrlText(JSON.stringify(payload));
    const signature = await signActorHeader(actor, secret);
    return { actor, signature };
  } catch (error) {
    console.error('campaign.notes.runtime_assertion.sign_failed', {
      campaignSlug: input.campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return null;
  }
}

export function resolveCampaignNotesRuntimeRole(input: { isMember: boolean; isGm: boolean }): CampaignNotesRuntimeRole | null {
  if (input.isGm) {
    return 'gm';
  }

  if (input.isMember) {
    return 'member';
  }

  return null;
}
