interface SendVerificationEmailInput {
  env?: Record<string, unknown>;
  email: string;
  verificationUrl: string;
}

interface SendContactEmailInput {
  env?: Record<string, unknown>;
  name: string;
  email: string;
  message: string;
  requestId: string;
}

interface EmailProvider {
  sendVerificationEmail(input: SendVerificationEmailInput): Promise<void>;
  sendContactEmail(input: SendContactEmailInput): Promise<void>;
}

interface EmailEnv {
  emailFrom?: string;
  emailReplyTo?: string;
  contactToEmail?: string;
  routeMode?: string;
  endpoint?: string;
  apiKey?: string;
}

function readEnvString(env: Record<string, unknown>, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  return value;
}

function getEnv(overrides?: Record<string, unknown>): EmailEnv {
  if (overrides) {
    return {
      emailFrom: readEnvString(overrides, 'EMAIL_FROM'),
      emailReplyTo: readEnvString(overrides, 'EMAIL_REPLY_TO'),
      contactToEmail: readEnvString(overrides, 'CONTACT_TO_EMAIL'),
      routeMode: readEnvString(overrides, 'EMAIL_WORKER_ROUTE_MODE'),
      endpoint: readEnvString(overrides, 'EMAIL_WORKER_ENDPOINT'),
      apiKey: readEnvString(overrides, 'EMAIL_WORKER_API_KEY'),
    };
  }

  return {
    emailFrom: import.meta.env.EMAIL_FROM,
    emailReplyTo: import.meta.env.EMAIL_REPLY_TO,
    contactToEmail: import.meta.env.CONTACT_TO_EMAIL,
    routeMode: import.meta.env.EMAIL_WORKER_ROUTE_MODE,
    endpoint: import.meta.env.EMAIL_WORKER_ENDPOINT,
    apiKey: import.meta.env.EMAIL_WORKER_API_KEY,
  };
}

class CloudflareRouteEmailProvider implements EmailProvider {
  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    const env = getEnv(input.env);
    if (env.routeMode === 'dry-run') {
      return;
    }

    if (!env.endpoint || !env.emailFrom) {
      throw new Error('EMAIL_WORKER_ENDPOINT and EMAIL_FROM are required when email route mode is not dry-run');
    }

    const response = await fetch(env.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.apiKey ? { authorization: `Bearer ${env.apiKey}` } : {}),
      },
      body: JSON.stringify({
        type: 'verification',
        from: env.emailFrom,
        to: input.email,
        replyTo: env.emailReplyTo,
        subject: 'Verify your Aletheia account',
        text: `Use this link to verify your account: ${input.verificationUrl}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Verification email relay failed with status ${response.status}`);
    }
  }

  async sendContactEmail(input: SendContactEmailInput): Promise<void> {
    const env = getEnv(input.env);
    if (env.routeMode === 'dry-run') {
      return;
    }

    if (!env.endpoint || !env.contactToEmail || !env.emailFrom) {
      throw new Error('EMAIL_WORKER_ENDPOINT, EMAIL_FROM and CONTACT_TO_EMAIL are required for contact relay');
    }

    const response = await fetch(env.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.apiKey ? { authorization: `Bearer ${env.apiKey}` } : {}),
      },
      body: JSON.stringify({
        type: 'contact',
        from: env.emailFrom,
        to: env.contactToEmail,
        replyTo: input.email,
        subject: `Aletheia contact form: ${input.name}`,
        text: input.message,
        metadata: {
          requestId: input.requestId,
          senderName: input.name,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Contact email relay failed with status ${response.status}`);
    }
  }
}

const provider: EmailProvider = new CloudflareRouteEmailProvider();

export async function sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
  await provider.sendVerificationEmail(input);
}

export async function sendContactEmail(input: SendContactEmailInput): Promise<void> {
  await provider.sendContactEmail(input);
}

export type { SendContactEmailInput, SendVerificationEmailInput };
