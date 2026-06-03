import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendPasswordResetEmail } from '~/lib/email';

describe('password reset Mailjet email', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the expected Mailjet reset payload and request id header', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendPasswordResetEmail({
      env: {
        MAILJET_API_KEY: 'api-key',
        MAILJET_SECRET_KEY: 'secret-key',
        EMAIL_FROM: 'gm@worldofaletheia.com',
        EMAIL_REPLY_TO: 'reply@worldofaletheia.com',
        MAILJET_SANDBOX_MODE: 'on',
      },
      email: 'user@example.com',
      resetUrl: 'https://worldofaletheia.com/reset-password?token=raw-token',
      expiresInMinutes: 30,
      requestId: 'request-1',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    const payload = JSON.parse(bodyText) as {
      SandboxMode: boolean;
      Messages: Array<{
        To: Array<{ Email: string }>;
        Subject: string;
        TextPart: string;
        Headers: Record<string, string>;
      }>;
    };

    expect(payload.SandboxMode).toBe(true);
    expect(payload.Messages[0].To).toEqual([{ Email: 'user@example.com' }]);
    expect(payload.Messages[0].Subject).toBe('Reset your Aletheia password');
    expect(payload.Messages[0].TextPart).toContain('https://worldofaletheia.com/reset-password?token=raw-token');
    expect(payload.Messages[0].Headers['X-Aletheia-Request-Id']).toBe('request-1');
  });

  it('fails closed for missing Mailjet env without leaking reset URLs', async () => {
    await expect(
      sendPasswordResetEmail({
        env: {},
        email: 'user@example.com',
        resetUrl: 'https://worldofaletheia.com/reset-password?token=raw-token',
        expiresInMinutes: 30,
        requestId: 'request-1',
      }),
    ).rejects.toThrow('password reset email');

    await expect(
      sendPasswordResetEmail({
        env: {},
        email: 'user@example.com',
        resetUrl: 'https://worldofaletheia.com/reset-password?token=raw-token',
        expiresInMinutes: 30,
        requestId: 'request-1',
      }),
    ).rejects.not.toThrow('raw-token');
  });
});
