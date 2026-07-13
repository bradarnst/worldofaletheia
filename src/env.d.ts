/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly CONTENT_SOURCE_MODE?: 'local' | 'cloud';
  readonly CONTENT_SOURCE_OVERRIDES?: string;
  readonly CONTENT_LOADER_D1_MODE?: 'local' | 'remote';
  readonly CONTENT_LOADER_D1_ENV?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly CAMPAIGN_MEMBERSHIPS?: string;
  readonly EMAIL_FROM?: string;
  readonly EMAIL_REPLY_TO?: string;
  readonly CONTACT_TO_EMAIL?: string;
  readonly MAILJET_API_KEY?: string;
  readonly MAILJET_SECRET_KEY?: string;
  readonly MAILJET_SANDBOX_MODE?: 'on' | 'off';
  readonly CF_PAGES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
