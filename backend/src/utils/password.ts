import bcrypt from "bcryptjs";
import { env } from "../config/env";

/** Hash a plaintext password. Never store or log the plaintext. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, env.BCRYPT_SALT_ROUNDS);
}

/** Compare a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Minimum password strength policy enforced server-side (never trust
 * client-side-only validation). Kept simple and explainable rather than
 * an opaque entropy score.
 */
export function passwordMeetsPolicy(password: string): { ok: boolean; reason?: string } {
  if (password.length < 10) return { ok: false, reason: "Password must be at least 10 characters." };
  if (!/[a-z]/.test(password)) return { ok: false, reason: "Password must include a lowercase letter." };
  if (!/[A-Z]/.test(password)) return { ok: false, reason: "Password must include an uppercase letter." };
  if (!/[0-9]/.test(password)) return { ok: false, reason: "Password must include a number." };
  return { ok: true };
}
