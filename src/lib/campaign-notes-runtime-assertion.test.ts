import { describe, expect, it } from 'vitest';
import {
  createCampaignNotesRuntimeActorAssertion,
  resolveCampaignNotesRuntimeRole,
  type CampaignNotesRuntimeActorPayload,
} from './campaign-notes-runtime-assertion';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function signActor(actor: string, secret: string): Promise<string> {
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

function decodeActorPayload(actor: string): CampaignNotesRuntimeActorPayload {
  return JSON.parse(textDecoder.decode(decodeBase64Url(actor))) as CampaignNotesRuntimeActorPayload;
}

describe('campaign notes runtime assertion', () => {
  it('creates the minimal actor payload and signs the encoded actor header', async () => {
    const assertion = await createCampaignNotesRuntimeActorAssertion({
      userId: 'user-123',
      campaignSlug: 'barry',
      role: 'gm',
      now: new Date('2026-07-01T12:00:00.000Z'),
      env: {
        CAMPAIGN_NOTES_ENVIRONMENT: 'staging',
        CAMPAIGN_NOTES_RUNTIME_ASSERTION_SECRET: 'test-secret',
      },
    });

    expect(assertion).not.toBeNull();
    if (!assertion) {
      throw new Error('Expected assertion to be created');
    }

    const payload = decodeActorPayload(assertion.actor);
    expect(Object.keys(payload)).toEqual([
      'userId',
      'campaignSlug',
      'role',
      'environment',
      'issuedAt',
      'expiresAt',
    ]);
    expect(payload).toEqual({
      userId: 'user-123',
      campaignSlug: 'barry',
      role: 'gm',
      environment: 'staging',
      issuedAt: '2026-07-01T12:00:00.000Z',
      expiresAt: '2026-07-01T12:05:00.000Z',
    });
    await expect(signActor(assertion.actor, 'test-secret')).resolves.toBe(assertion.signature);
  });

  it('omits assertions when signing material is missing or invalid', async () => {
    await expect(createCampaignNotesRuntimeActorAssertion({
      userId: 'user-123',
      campaignSlug: 'barry',
      role: 'member',
      env: { CAMPAIGN_NOTES_ENVIRONMENT: 'staging' },
    })).resolves.toBeNull();

    await expect(createCampaignNotesRuntimeActorAssertion({
      userId: 'user-123',
      campaignSlug: 'barry',
      role: 'member',
      env: {
        CAMPAIGN_NOTES_ENVIRONMENT: 'preview',
        CAMPAIGN_NOTES_RUNTIME_ASSERTION_SECRET: 'test-secret',
      },
    })).resolves.toBeNull();
  });

  it('maps campaign access to the narrow runtime role', () => {
    expect(resolveCampaignNotesRuntimeRole({ isMember: false, isGm: false })).toBeNull();
    expect(resolveCampaignNotesRuntimeRole({ isMember: true, isGm: false })).toBe('member');
    expect(resolveCampaignNotesRuntimeRole({ isMember: false, isGm: true })).toBe('gm');
    expect(resolveCampaignNotesRuntimeRole({ isMember: true, isGm: true })).toBe('gm');
  });
});
