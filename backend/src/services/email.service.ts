import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../utils/logger";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Provider is chosen via EMAIL_PROVIDER. "console" (default for local dev)
 * just logs the email so you can click links without a real mail server.
 * "smtp" sends through any SMTP provider (SES, SendGrid, Postmark, Mailgun
 * all offer SMTP endpoints — set SMTP_HOST/PORT/USER/PASS in .env).
 * To add a provider-specific SDK (e.g. SES API instead of SMTP), add a case
 * here — nothing else in the codebase needs to change.
 */
async function send(input: SendEmailInput): Promise<void> {
  if (env.EMAIL_PROVIDER === "console") {
    logger.info({ to: input.to, subject: input.subject }, "[DEV EMAIL] " + input.text);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

export const emailService = {
  async sendVerificationEmail(to: string, firstName: string, token: string) {
    const link = `${env.APP_URL}/verify-email?token=${token}`;
    await send({
      to,
      subject: "Verify your Campus Pulse account",
      text: `Hi ${firstName}, verify your email: ${link} (expires in 24 hours)`,
      html: `<p>Hi ${escapeHtml(firstName)},</p><p>Welcome to Campus Pulse! Verify your email to get started:</p><p><a href="${link}">Verify my email</a></p><p>This link expires in 24 hours.</p>`,
    });
  },

  async sendPasswordResetEmail(to: string, firstName: string, token: string) {
    const link = `${env.APP_URL}/reset-password?token=${token}`;
    await send({
      to,
      subject: "Reset your Campus Pulse password",
      text: `Hi ${firstName}, reset your password: ${link} (expires in 1 hour). If you didn't request this, ignore this email.`,
      html: `<p>Hi ${escapeHtml(firstName)},</p><p>We received a request to reset your password:</p><p><a href="${link}">Reset my password</a></p><p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
    });
  },

  async sendWelcomeEmail(to: string, firstName: string) {
    await send({
      to,
      subject: "Welcome to Campus Pulse",
      text: `Hi ${firstName}, your email is verified. Let's build your profile.`,
      html: `<p>Hi ${escapeHtml(firstName)},</p><p>Your email is verified — welcome to Campus Pulse. Don't just match faces, match lives.</p>`,
    });
  },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
