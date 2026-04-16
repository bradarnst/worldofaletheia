interface SendVerificationEmailInput {
  env?: Record<string, unknown>;
  email: string;
  verificationUrl: string;
}

interface SendContactEmailInput {
  env?: Record<string, unknown>;
  kind?: 'contact' | 'contribute';
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
  mailjetApiKey?: string;
  mailjetSecretKey?: string;
  mailjetSandboxMode?: string;
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
      mailjetApiKey: readEnvString(overrides, 'MAILJET_API_KEY'),
      mailjetSecretKey: readEnvString(overrides, 'MAILJET_SECRET_KEY'),
      mailjetSandboxMode: readEnvString(overrides, 'MAILJET_SANDBOX_MODE'),
    };
  }

  return {
    emailFrom: import.meta.env.EMAIL_FROM,
    emailReplyTo: import.meta.env.EMAIL_REPLY_TO,
    contactToEmail: import.meta.env.CONTACT_TO_EMAIL,
    mailjetApiKey: import.meta.env.MAILJET_API_KEY,
    mailjetSecretKey: import.meta.env.MAILJET_SECRET_KEY,
    mailjetSandboxMode: import.meta.env.MAILJET_SANDBOX_MODE,
  };
}

function isSandboxEnabled(value: string | undefined): boolean {
  return value === 'on' || value === 'true' || value === '1';
}

function createMailjetAuthorizationHeader(apiKey: string, secretKey: string): string {
  const encoded = btoa(`${apiKey}:${secretKey}`);
  return `Basic ${encoded}`;
}

function toMailjetRecipientList(csvEmails: string | undefined): Array<{ Email: string }> {
  if (!csvEmails) {
    return [];
  }

  return csvEmails
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((email) => ({ Email: email }));
}

class MailjetEmailProvider implements EmailProvider {
  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    const env = getEnv(input.env);
    if (!env.mailjetApiKey || !env.mailjetSecretKey || !env.emailFrom) {
      throw new Error('MAILJET_API_KEY, MAILJET_SECRET_KEY and EMAIL_FROM are required for verification email');
    }

    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: createMailjetAuthorizationHeader(env.mailjetApiKey, env.mailjetSecretKey),
      },
      body: JSON.stringify({
        SandboxMode: isSandboxEnabled(env.mailjetSandboxMode),
        Messages: [
          {
            From: {
              Email: env.emailFrom,
            },
            To: [{ Email: input.email }],
            ...(env.emailReplyTo
              ? {
                  ReplyTo: {
                    Email: env.emailReplyTo,
                  },
                }
              : {}),
            Subject: 'Verify your Aletheia account',
            TextPart: `Use this link to verify your account: ${input.verificationUrl}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Verification email relay failed with status ${response.status}`);
    }
  }

  async sendContactEmail(input: SendContactEmailInput): Promise<void> {
    const env = getEnv(input.env);
    if (!env.mailjetApiKey || !env.mailjetSecretKey || !env.contactToEmail || !env.emailFrom) {
      throw new Error('MAILJET_API_KEY, MAILJET_SECRET_KEY, EMAIL_FROM and CONTACT_TO_EMAIL are required for contact relay');
    }

    const recipients = toMailjetRecipientList(env.contactToEmail);
    if (recipients.length === 0) {
      throw new Error('CONTACT_TO_EMAIL must contain at least one valid recipient email');
    }

    const formLabel = input.kind === 'contribute' ? 'contribution' : 'contact';

    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: createMailjetAuthorizationHeader(env.mailjetApiKey, env.mailjetSecretKey),
      },
      body: JSON.stringify({
        SandboxMode: isSandboxEnabled(env.mailjetSandboxMode),
        Messages: [
          {
            From: {
              Email: env.emailFrom,
            },
            To: recipients,
            ReplyTo: {
              Email: input.email,
            },
            Subject: `Aletheia ${formLabel} form: ${input.name}`,
            TextPart: input.message,
            Headers: {
              'X-Aletheia-Request-Id': input.requestId,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Contact email relay failed with status ${response.status}`);
    }
  }
}

const provider: EmailProvider = new MailjetEmailProvider();

export async function sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
  await provider.sendVerificationEmail(input);
}

export async function sendContactEmail(input: SendContactEmailInput): Promise<void> {
  await provider.sendContactEmail(input);
}

export type { SendContactEmailInput, SendVerificationEmailInput };
