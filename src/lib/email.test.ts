import { describe, expect, it, vi } from 'vitest';
import { sendContactEmail, sendVerificationEmail } from './email';

describe('email adapter', () => {
  it('sends verification email through Mailjet with sandbox mode enabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 202,
      }),
    );

    await sendVerificationEmail({
      env: {
        MAILJET_API_KEY: 'mailjet-api-key',
        MAILJET_SECRET_KEY: 'mailjet-secret-key',
        MAILJET_SANDBOX_MODE: 'on',
        EMAIL_FROM: 'gm@worldofaletheia.com',
      },
      email: 'reader@example.com',
      verificationUrl: 'https://worldofaletheia.com/verify?token=abc',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('calls Mailjet endpoint for verification email', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 202,
      }),
    );

    await sendVerificationEmail({
      env: {
        MAILJET_API_KEY: 'mailjet-api-key',
        MAILJET_SECRET_KEY: 'mailjet-secret-key',
        MAILJET_SANDBOX_MODE: 'off',
        EMAIL_FROM: 'gm@worldofaletheia.com',
        EMAIL_REPLY_TO: 'gm@worldofaletheia.com',
      },
      email: 'reader@example.com',
      verificationUrl: 'https://worldofaletheia.com/verify?token=abc',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.mailjet.com/v3.1/send',
      expect.objectContaining({
        method: 'POST',
      }),
    );
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
          MAILJET_API_KEY: 'mailjet-api-key',
          MAILJET_SECRET_KEY: 'mailjet-secret-key',
          MAILJET_SANDBOX_MODE: 'on',
          EMAIL_FROM: 'gm@worldofaletheia.com',
          CONTACT_TO_EMAIL: 'brad@worldofaletheia.com,barry@worldofaletheia.com',
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
