import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";

const VERIFY_URLS: Record<string, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  hcaptcha: "https://hcaptcha.com/siteverify",
};

/**
 * Verifies a CAPTCHA token against the configured provider. No-ops when
 * CAPTCHA_PROVIDER=none (the default), so this never breaks local dev or
 * existing tests — set CAPTCHA_PROVIDER + CAPTCHA_SECRET_KEY in .env to turn
 * bot protection on for registration/login without any other code changes.
 *
 * The frontend side (rendering the widget and sending `captchaToken` in the
 * request body) is not wired up here since it requires a real site key —
 * this is the "complete integration structure, env vars identified" half;
 * plug in the widget once you have Turnstile/hCaptcha credentials.
 */
export async function verifyCaptcha(token: string | undefined, ip?: string): Promise<void> {
  if (env.CAPTCHA_PROVIDER === "none") return;

  if (!token) {
    throw new AppError(400, "CAPTCHA_REQUIRED", "Please complete the CAPTCHA challenge.");
  }

  const verifyUrl = VERIFY_URLS[env.CAPTCHA_PROVIDER];
  const body = new URLSearchParams({
    secret: env.CAPTCHA_SECRET_KEY ?? "",
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  });

  const res = await fetch(verifyUrl, { method: "POST", body });
  const data = (await res.json()) as { success: boolean };

  if (!data.success) {
    throw new AppError(400, "CAPTCHA_FAILED", "CAPTCHA verification failed. Please try again.");
  }
}
