import { getAuth } from './auth';

interface SessionUser {
  id: string;
  email: string;
  name: string;
}

interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: string | Date;
}

export interface RequestSession {
  user: SessionUser;
  session: SessionRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asRequestSession(payload: unknown): RequestSession | null {
  if (!isRecord(payload)) {
    return null;
  }

  const user = payload.user;
  const session = payload.session;
  if (!isRecord(user) || !isRecord(session)) {
    return null;
  }

  if (
    typeof user.id !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.name !== 'string' ||
    typeof session.id !== 'string' ||
    typeof session.userId !== 'string'
  ) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: (session.expiresAt as string | Date | undefined) ?? '',
    },
  };
}

export async function getRequestSession(request: Request, locals: unknown): Promise<RequestSession | null> {
  try {
    const auth = getAuth(locals);
    const requestUrl = new URL(request.url);
    const sessionUrl = new URL('/api/auth/get-session', requestUrl.origin);

    const response = await auth.handler(
      new Request(sessionUrl.toString(), {
        method: 'GET',
        headers: {
          cookie: request.headers.get('cookie') ?? '',
        },
      }),
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return asRequestSession(payload);
  } catch (error) {
    console.error('auth.session.resolve_failed', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return null;
  }
}

