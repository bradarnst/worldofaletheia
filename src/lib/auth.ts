import { betterAuth } from 'better-auth';
import { type BetterAuthOptions } from 'better-auth';
import { getD1BindingFromLocals, getD1BindingFromRuntimeEnv } from './d1';
import { sendVerificationEmail } from './email';

interface LocalsLike {
  cfContext?: {
    env?: Record<string, unknown>;
  };
  runtime?: {
    env?: Record<string, unknown>;
  };
}

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
    database: getD1BindingFromRuntimeEnv(env) as BetterAuthOptions['database'],
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
  };
}

export function getAuth(locals: unknown) {
  const typedLocals = (locals as LocalsLike | undefined) ?? {};
  const d1 = getD1BindingFromLocals(typedLocals);
  const existing = authByBinding.get(d1 as unknown as object);
  if (existing) {
    return existing;
  }

  const runtimeEnv = typedLocals.cfContext?.env ?? typedLocals.runtime?.env;
  if (!runtimeEnv) {
    throw new Error('Cloudflare runtime environment is required for auth initialization');
  }

  const auth = betterAuth(buildAuthOptions(runtimeEnv));
  authByBinding.set(d1 as unknown as object, auth);
  return auth;
}
