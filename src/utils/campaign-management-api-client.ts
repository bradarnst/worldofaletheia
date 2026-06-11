export type CampaignRole = 'member' | 'gm';

export interface CampaignMember {
  userId: string;
  displayName: string | null;
  email: string;
  role: CampaignRole;
  joinedAt?: string | null;
  updatedAt?: string | null;
}

export interface CampaignMemberPage {
  campaignSlug: string;
  items: CampaignMember[];
  nextCursor: string | null;
}

export interface CampaignAdminCapability {
  campaignSlug: string;
  actor: {
    userId: string;
    displayName: string | null;
  };
  canAdministerUsers: boolean;
  capabilities: Array<'user-admin'>;
  source: 'campaign-gm' | 'global-admin' | 'none';
}

export interface AddCampaignMemberRequest {
  email: string;
  role: CampaignRole;
}

export interface MembershipRoleRequest {
  role: CampaignRole;
  reason?: string | null;
}

export interface CampaignMemberCreateResponse {
  member: CampaignMember;
  outcome: 'created';
  confirmationMessage: string;
}

export interface CampaignMemberUpdateResponse {
  member: CampaignMember;
  outcome: 'updated' | 'unchanged';
  confirmationMessage: string;
}

export interface CampaignMembershipSummary {
  campaignSlug: string;
  userId: string;
  role: CampaignRole;
  grantedAt?: string | null;
  updatedAt?: string | null;
}

export interface CampaignMemberRevokeResponse {
  revokedMembership: CampaignMembershipSummary;
  outcome: 'revoked';
  confirmationMessage: string;
}

export interface ApiError {
  error: string;
  message: string;
  requestId?: string;
}

export interface CampaignApiErrorDetails extends ApiError {
  status: number;
}

export class CampaignApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly requestId?: string;

  constructor(details: CampaignApiErrorDetails) {
    super(details.message);
    this.name = 'CampaignApiError';
    this.status = details.status;
    this.error = details.error;
    this.requestId = details.requestId;
  }
}

export interface ListCampaignMembersOptions {
  campaignSlug: string;
  role?: CampaignRole;
  limit?: number;
  cursor?: string | null;
}

export interface AddCampaignMemberOptions extends AddCampaignMemberRequest {
  campaignSlug: string;
}

export interface UpdateCampaignMemberOptions extends MembershipRoleRequest {
  campaignSlug: string;
  userId: string;
}

export interface RevokeCampaignMemberOptions {
  campaignSlug: string;
  userId: string;
  reason?: string | null;
}

type FetchJsonOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
};

const JSON_ACCEPT_HEADERS = {
  Accept: 'application/json',
};

function campaignBasePath(campaignSlug: string): string {
  return `/api/v1/campaigns/${encodeURIComponent(campaignSlug)}`;
}

function memberPath(campaignSlug: string, userId: string): string {
  return `${campaignBasePath(campaignSlug)}/members/${encodeURIComponent(userId)}`;
}

export function buildCampaignAdminCapabilityUrl(campaignSlug: string): string {
  return `${campaignBasePath(campaignSlug)}/admin-capability`;
}

export function buildCampaignMembersUrl(options: ListCampaignMembersOptions): string {
  const searchParams = new URLSearchParams();

  if (options.role) {
    searchParams.set('role', options.role);
  }

  if (options.limit !== undefined) {
    searchParams.set('limit', String(options.limit));
  }

  if (options.cursor) {
    searchParams.set('cursor', options.cursor);
  }

  const query = searchParams.toString();
  return `${campaignBasePath(options.campaignSlug)}/members${query ? `?${query}` : ''}`;
}

async function parseApiError(response: Response): Promise<CampaignApiError> {
  try {
    const body = (await response.json()) as Partial<ApiError>;
    return new CampaignApiError({
      status: response.status,
      error: typeof body.error === 'string' ? body.error : 'request_failed',
      message: typeof body.message === 'string' ? body.message : 'Campaign request failed.',
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    });
  } catch {
    return new CampaignApiError({
      status: response.status,
      error: 'request_failed',
      message: response.statusText || 'Campaign request failed.',
    });
  }
}

async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const headers: HeadersInit = options.body === undefined
    ? JSON_ACCEPT_HEADERS
    : {
        ...JSON_ACCEPT_HEADERS,
        'Content-Type': 'application/json',
      };

  const response = await fetch(url, {
    method: options.method,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

export function getCampaignAdminCapability(campaignSlug: string): Promise<CampaignAdminCapability> {
  return fetchJson<CampaignAdminCapability>(buildCampaignAdminCapabilityUrl(campaignSlug), { method: 'GET' });
}

export function listCampaignMembers(options: ListCampaignMembersOptions): Promise<CampaignMemberPage> {
  return fetchJson<CampaignMemberPage>(buildCampaignMembersUrl(options), { method: 'GET' });
}

export function addCampaignMember(options: AddCampaignMemberOptions): Promise<CampaignMemberCreateResponse> {
  const { campaignSlug, email, role } = options;
  return fetchJson<CampaignMemberCreateResponse>(`${campaignBasePath(campaignSlug)}/members`, {
    method: 'POST',
    body: { email, role },
  });
}

export function updateCampaignMember(options: UpdateCampaignMemberOptions): Promise<CampaignMemberUpdateResponse> {
  const { campaignSlug, userId, role, reason } = options;
  return fetchJson<CampaignMemberUpdateResponse>(memberPath(campaignSlug, userId), {
    method: 'PUT',
    body: { role, reason: reason ?? null },
  });
}

export function revokeCampaignMember(options: RevokeCampaignMemberOptions): Promise<CampaignMemberRevokeResponse> {
  const { campaignSlug, userId, reason } = options;
  return fetchJson<CampaignMemberRevokeResponse>(memberPath(campaignSlug, userId), {
    method: 'DELETE',
    body: { reason: reason ?? null },
  });
}
