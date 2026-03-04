/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly CAMPAIGN_MEMBERSHIPS?: string;
  readonly EMAIL_FROM?: string;
  readonly EMAIL_REPLY_TO?: string;
  readonly CONTACT_TO_EMAIL?: string;
  readonly EMAIL_WORKER_ROUTE_MODE?: 'dry-run' | 'live';
  readonly EMAIL_WORKER_ENDPOINT?: string;
  readonly EMAIL_WORKER_API_KEY?: string;
  readonly CF_PAGES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

