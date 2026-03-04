import { describe, expect, it, vi } from 'vitest';
import { sendContactEmail, sendVerificationEmail } from './email';

describe('email adapter', () => {
  it('skips outbound call in dry-run mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await sendVerificationEmail({
      env: {
        EMAIL_WORKER_ROUTE_MODE: 'dry-run',
      },
      email: 'reader@example.com',
      verificationUrl: 'https://worldofaletheia.com/verify?token=abc',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('calls email route endpoint for verification email', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 202,
      }),
    );

    await sendVerificationEmail({
      env: {
        EMAIL_WORKER_ROUTE_MODE: 'live',
        EMAIL_WORKER_ENDPOINT: 'https://mailer.example.workers.dev/send',
        EMAIL_FROM: 'noreply@worldofaletheia.com',
        EMAIL_REPLY_TO: 'support@worldofaletheia.com',
        EMAIL_WORKER_API_KEY: 'secret-key',
      },
      email: 'reader@example.com',
      verificationUrl: 'https://worldofaletheia.com/verify?token=abc',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('throws on non-success contact relay response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 500,
      }),
    );

    await expect(
      sendContactEmail({
        env: {
          EMAIL_WORKER_ROUTE_MODE: 'live',
          EMAIL_WORKER_ENDPOINT: 'https://mailer.example.workers.dev/send',
          EMAIL_FROM: 'noreply@worldofaletheia.com',
          CONTACT_TO_EMAIL: 'gm@worldofaletheia.com',
        },
        name: 'Brad',
        email: 'brad@example.com',
        message: 'Hello',
        requestId: 'request-1',
      }),
    ).rejects.toThrow('Contact email relay failed with status 500');

    fetchSpy.mockRestore();
  });
});

