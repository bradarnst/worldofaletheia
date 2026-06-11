import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { getRequestSession, type RequestSession } from '~/lib/auth-session';
import { CampaignMembershipRepo, createCampaignMembershipRepoFromLocals } from '~/lib/campaign-membership-repo';
import { normalizeEmail } from '~/lib/email-normalization';
import { extractCampaignSlugFromEntryId } from '@utils/campaign-collections';
import { getNoIndexHeaders } from '@utils/seo';

export type CampaignRole = 'member' | 'gm';

export interface ErrorResponseBody {
  error: string;
  message: string;
  requestId: string;
}

export interface CampaignMemberDto {
  userId: string;
  displayName: string | null;
  email: string;
  role: CampaignRole;
  joinedAt: string | null;
  updatedAt: string | null;
}

export interface CampaignMemberPageDto {
  campaignSlug: string;
  items: CampaignMemberDto[];
  nextCursor: string | null;
}

export interface CampaignMemberCreateResponseDto {
  member: CampaignMemberDto;
  outcome: 'created';
  confirmationMessage: string;
}

export interface CampaignAdminCapabilityDto {
  campaignSlug: string;
  actor: {
    userId: string;
    displayName: string | null;
  };
  canAdministerUsers: boolean;
  capabilities: 'user-admin'[];
  source: 'campaign-gm' | 'global-admin' | 'none';
}

export interface CampaignAdminContext {
  campaignSlug: string;
  session: RequestSession;
  repo: CampaignMembershipRepo;
}

const CAMPAIGN_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const USER_ID_CURSOR_PATTERN = /^[A-Za-z0-9_:\-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type CampaignMemberEmailAddBody = {
  email: string;
  role: CampaignRole;
};

function createRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: getNoIndexHeaders('application/json'),
  });
}

export function errorResponse(status: number, error: string, message: string): Response {
  const body: ErrorResponseBody = {
    error,
    message,
    requestId: createRequestId(),
  };

  return jsonResponse(body, status);
}

export function validateCampaignSlug(value: string | undefined): string | null {
  if (!value || value.length > 80 || !CAMPAIGN_SLUG_PATTERN.test(value)) {
    return null;
  }

  return value;
}

export function parseCampaignMemberListQuery(url: URL):
  | { ok: true; role?: CampaignRole; limit: number; cursor: string | null }
  | { ok: false; message: string } {
  const role = url.searchParams.get('role');
  if (role !== null && role !== 'member' && role !== 'gm') {
    return { ok: false, message: 'role must be one of member or gm.' };
  }

  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw === null ? DEFAULT_LIMIT : Number.parseInt(limitRaw, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, message: `limit must be an integer between 1 and ${MAX_LIMIT}.` };
  }

  const cursor = url.searchParams.get('cursor');
  if (cursor !== null && (cursor.length > 128 || !USER_ID_CURSOR_PATTERN.test(cursor))) {
    return { ok: false, message: 'cursor is invalid.' };
  }

  return {
    ok: true,
    role: role ?? undefined,
    limit,
    cursor,
  };
}

export async function parseCampaignMemberEmailAddRequest(
  request: Request,
): Promise<{ ok: true; body: CampaignMemberEmailAddBody } | { ok: false; message: string }> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return { ok: false, message: 'Request body must be valid JSON.' };
  }

  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { ok: false, message: 'Request body must be an object.' };
  }

  const allowedKeys = new Set(['email', 'role']);
  for (const key of Object.keys(rawBody)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, message: `${key} is not allowed.` };
    }
  }

  const { email, role } = rawBody as Record<string, unknown>;
  if (typeof email !== 'string') {
    return { ok: false, message: 'email is required.' };
  }

  const canonicalEmail = normalizeEmail(email);
  if (canonicalEmail.length === 0 || canonicalEmail.length > 254 || !EMAIL_PATTERN.test(canonicalEmail)) {
    return { ok: false, message: 'email must be a valid email address.' };
  }

  if (role !== 'member' && role !== 'gm') {
    return { ok: false, message: 'role must be one of member or gm.' };
  }

  return {
    ok: true,
    body: {
      email: canonicalEmail,
      role,
    },
  };
}

export async function campaignExists(campaignSlug: string): Promise<boolean> {
  const campaigns = await getCollection('campaigns');
  return campaigns.some((entry) => extractCampaignSlugFromEntryId(entry.id) === campaignSlug);
}

export async function getAuthenticatedCampaignAdminContext(
  context: APIContext,
): Promise<CampaignAdminContext | Response> {
  const campaignSlug = validateCampaignSlug(context.params.campaignSlug);
  if (!campaignSlug) {
    return errorResponse(400, 'invalid_request', 'campaignSlug is invalid.');
  }

  const session = await getRequestSession(context.request, context.locals);
  if (!session) {
    return errorResponse(401, 'unauthenticated', 'Authentication is required.');
  }

  try {
    if (!(await campaignExists(campaignSlug))) {
      return errorResponse(404, 'not_found', 'The campaign was not found.');
    }
  } catch (error) {
    console.error('campaign.admin_api.campaign_lookup_failed', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return errorResponse(503, 'service_unavailable', 'Service is temporarily unavailable.');
  }

  try {
    const repo = await createCampaignMembershipRepoFromLocals(context.locals);
    return {
      campaignSlug,
      session,
      repo,
    };
  } catch (error) {
    console.error('campaign.admin_api.repo_unavailable', {
      campaignSlug,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return errorResponse(503, 'service_unavailable', 'Service is temporarily unavailable.');
  }
}

export function isResponse(value: CampaignAdminContext | Response): value is Response {
  return value instanceof Response;
}
