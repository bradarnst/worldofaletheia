import { betterAuth } from 'better-auth';
import { type BetterAuthOptions } from 'better-auth';
import { getD1BindingFromLocals } from './d1';
import { sendVerificationEmail } from './email';

const authByBinding = new WeakMap<object, ReturnType<typeof betterAuth>>();

function getRequiredString(env: Record<string, unknown>, key: string): string {
  const value = env[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required auth environment variable: ${key}`);
  }

  return value;
}

function getOptionalString(env: Record<string, unknown>, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  return value;
}

function buildAuthOptions(env: Record<string, unknown>): BetterAuthOptions {
  const baseURL = getRequiredString(env, 'BETTER_AUTH_URL');
  const useSecureCookies = baseURL.startsWith('https://');
  const trustedOrigins = [getRequiredString(env, 'BETTER_AUTH_URL')];
  const cfPagesUrl = getOptionalString(env, 'CF_PAGES_URL');
  if (cfPagesUrl) {
    trustedOrigins.push(`https://${cfPagesUrl}`);
  }

  const googleClientId = getOptionalString(env, 'GOOGLE_CLIENT_ID');
  const googleClientSecret = getOptionalString(env, 'GOOGLE_CLIENT_SECRET');

  const socialProviders =
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
          // Provider map is intentionally shaped for additive provider rollout in later phases.
        }
      : undefined;

  return {
    baseURL,
    secret: getRequiredString(env, 'BETTER_AUTH_SECRET'),
    database: env.DB as BetterAuthOptions['database'],
    trustedOrigins,
    socialProviders,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    emailVerification: {
      sendVerificationEmail: async (data: {
        user: { email: string };
        url: string;
        token: string;
      }) => {
        await sendVerificationEmail({
          env,
          email: data.user.email,
          verificationUrl: data.url,
        });
      },
      sendOnSignUp: false,
      sendOnSignIn: false,
    },
    advanced: {
      useSecureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: useSecureCookies,
      },
    },
    account: {
      accountLinking: {
        enabled: true,
      },
    },
  };
}

// Astro v6 (Cloudflare): import env directly from cloudflare:workers rather than
// relying on Astro.locals.cfContext, which is not populated for API routes.
export async function getAuth(_locals: unknown): Promise<ReturnType<typeof betterAuth>> {
  const d1 = await getD1BindingFromLocals(_locals);
  const existing = authByBinding.get(d1 as unknown as object);
  if (existing) {
    return existing;
  }

  // cloudflare:workers env is the canonical runtime environment source in Astro v6.
  let runtimeEnv: Record<string, unknown>;
  try {
    const { env } = await import('cloudflare:workers');
    runtimeEnv = env as Record<string, unknown>;
  } catch {
    throw new Error('Cloudflare runtime environment is required for auth initialization');
  }

  const auth = betterAuth(buildAuthOptions(runtimeEnv));
  authByBinding.set(d1 as unknown as object, auth);
  return auth;
}
