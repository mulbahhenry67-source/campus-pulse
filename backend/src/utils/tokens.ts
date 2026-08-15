import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string; // user id
  role: string;
  sessionId?: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.JWT_ACCESS_TTL_MIN}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/**
 * Refresh tokens and one-time tokens (email verification, password reset) are
 * NOT JWTs. They're high-entropy random strings; only a SHA-256 hash is ever
 * stored in the database, so a database leak alone can't be used to forge
 * sessions or reset passwords. The raw token is only ever transmitted once
 * (in the response body / emailed link) and never persisted in plaintext.
 */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}
