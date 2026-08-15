import { randomUUID } from "crypto";
import { pool, withTransaction } from "../../db/pool";
import { userRepository, toPublicUser } from "../users/user.repository";
import { hashPassword, verifyPassword, passwordMeetsPolicy } from "../../utils/password";
import {
  signAccessToken,
  generateOpaqueToken,
  hashOpaqueToken,
  addDays,
  addMinutes,
} from "../../utils/tokens";
import { emailService } from "../../services/email.service";
import { AppError } from "../../middleware/errorHandler";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: string;
}

interface DeviceContext {
  userAgent?: string;
  ipAddress?: string;
}

function assertMinimumAge(dateOfBirth: string) {
  const dob = new Date(dateOfBirth);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - env.MIN_AGE_YEARS);
  if (Number.isNaN(dob.getTime()) || dob > cutoff) {
    throw new AppError(
      403,
      "AGE_RESTRICTED",
      `Campus Pulse requires users to be at least ${env.MIN_AGE_YEARS} years old.`,
    );
  }
}

async function issueSession(userId: string, role: string, ctx: DeviceContext, familyId?: string) {
  const family = familyId ?? randomUUID();
  const refreshToken = generateOpaqueToken();
  const refreshTokenHash = hashOpaqueToken(refreshToken);
  const expiresAt = addDays(new Date(), env.JWT_REFRESH_TTL_DAYS);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO user_sessions (user_id, refresh_token_hash, family_id, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, refreshTokenHash, family, ctx.userAgent ?? null, ctx.ipAddress ?? null, expiresAt],
  );

  const accessToken = signAccessToken({ sub: userId, role, sessionId: rows[0].id });
  return { accessToken, refreshToken, sessionId: rows[0].id, familyId: family };
}

async function audit(userId: string | null, eventType: string, metadata: Record<string, unknown> = {}, ctx?: DeviceContext) {
  await pool.query(
    `INSERT INTO audit_logs (user_id, event_type, metadata, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)`,
    [userId, eventType, JSON.stringify(metadata), ctx?.ipAddress ?? null, ctx?.userAgent ?? null],
  );
}

export const authService = {
  async register(input: RegisterInput, ctx: DeviceContext) {
    assertMinimumAge(input.dateOfBirth);

    const policy = passwordMeetsPolicy(input.password);
    if (!policy.ok) {
      throw new AppError(422, "WEAK_PASSWORD", policy.reason!);
    }

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      // Don't reveal whether the account exists via a distinct error — but for
      // registration UX this is an accepted tradeoff (login enumeration is
      // where it matters most). We still avoid leaking anything beyond "taken".
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
    });

    const rawToken = generateOpaqueToken();
    await pool.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, hashOpaqueToken(rawToken), addMinutes(new Date(), 24 * 60)],
    );

    await emailService.sendVerificationEmail(user.email, user.first_name, rawToken);
    await audit(user.id, "USER_REGISTERED", {}, ctx);

    const session = await issueSession(user.id, user.role, ctx);
    return { user: toPublicUser(user), ...session };
  },

  async verifyEmail(token: string) {
    const tokenHash = hashOpaqueToken(token);
    const { rows } = await pool.query<{ id: string; user_id: string; expires_at: string; consumed_at: string | null }>(
      `SELECT * FROM email_verifications WHERE token_hash = $1`,
      [tokenHash],
    );
    const record = rows[0];
    if (!record || record.consumed_at || new Date(record.expires_at) < new Date()) {
      throw new AppError(400, "INVALID_OR_EXPIRED_TOKEN", "This verification link is invalid or has expired.");
    }

    await withTransaction(async (client) => {
      await client.query(`UPDATE email_verifications SET consumed_at = now() WHERE id = $1`, [record.id]);
      await client.query(`UPDATE users SET email_verified_at = now() WHERE id = $1`, [record.user_id]);
    });

    const user = await userRepository.findById(record.user_id);
    if (user) await emailService.sendWelcomeEmail(user.email, user.first_name);
    await audit(record.user_id, "EMAIL_VERIFIED");
    return { verified: true };
  },

  async login(email: string, password: string, ctx: DeviceContext) {
    const user = await userRepository.findByEmail(email);

    // Constant-shape response whether or not the user exists, to resist
    // account enumeration via timing/response differences.
    if (!user) {
      await hashPassword(password); // burn roughly the same time as a real compare
      throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError(423, "ACCOUNT_LOCKED", "Too many failed attempts. Try again in a few minutes.");
    }

    if (user.status !== "active") {
      throw new AppError(403, "ACCOUNT_NOT_ACTIVE", "This account is not active. Contact support.");
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await userRepository.recordLoginFailure(user.id);
      await audit(user.id, "LOGIN_FAILED", {}, ctx);
      throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
    }

    await userRepository.recordLoginSuccess(user.id);
    await audit(user.id, "LOGIN_SUCCESS", {}, ctx);

    const session = await issueSession(user.id, user.role, ctx);
    return { user: toPublicUser(user), ...session };
  },

  /**
   * Refresh-token rotation with reuse detection. Each refresh consumes the
   * presented token and issues a new one in the same "family". If a token is
   * presented that was already rotated-out (or unknown), we treat it as a
   * likely theft and revoke the entire session family, forcing re-login on
   * every device that shared it.
   */
  async refresh(refreshToken: string, ctx: DeviceContext) {
    const tokenHash = hashOpaqueToken(refreshToken);
    const { rows } = await pool.query<{
      id: string;
      user_id: string;
      family_id: string;
      revoked_at: string | null;
      expires_at: string;
    }>(`SELECT * FROM user_sessions WHERE refresh_token_hash = $1`, [tokenHash]);

    const session = rows[0];
    if (!session) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Session not recognized. Please log in again.");
    }

    if (session.revoked_at) {
      // Reused a rotated-out (or already-revoked) token — assume compromise.
      await pool.query(
        `UPDATE user_sessions SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`,
        [session.family_id],
      );
      await audit(session.user_id, "REFRESH_TOKEN_REUSE_DETECTED", { familyId: session.family_id }, ctx);
      throw new AppError(401, "SESSION_REVOKED", "Session invalidated for security reasons. Please log in again.");
    }

    if (new Date(session.expires_at) < new Date()) {
      throw new AppError(401, "REFRESH_TOKEN_EXPIRED", "Session expired. Please log in again.");
    }

    const user = await userRepository.findById(session.user_id);
    if (!user || user.status !== "active") {
      throw new AppError(403, "ACCOUNT_NOT_ACTIVE", "This account is not active.");
    }

    const next = await issueSession(user.id, user.role, ctx, session.family_id);
    await pool.query(
      `UPDATE user_sessions SET revoked_at = now(), replaced_by_id = $1 WHERE id = $2`,
      [next.sessionId, session.id],
    );

    return { user: toPublicUser(user), ...next };
  },

  async logout(refreshToken: string) {
    const tokenHash = hashOpaqueToken(refreshToken);
    await pool.query(
      `UPDATE user_sessions SET revoked_at = now() WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  },

  async logoutAllSessions(userId: string) {
    await pool.query(
      `UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    await audit(userId, "LOGOUT_ALL_SESSIONS");
  },

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    // Always respond as if successful — never reveal whether the email exists.
    if (!user) {
      logger.info({ email }, "Password reset requested for unknown email");
      return { requested: true };
    }

    const rawToken = generateOpaqueToken();
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, hashOpaqueToken(rawToken), addMinutes(new Date(), 60)],
    );
    await emailService.sendPasswordResetEmail(user.email, user.first_name, rawToken);
    await audit(user.id, "PASSWORD_RESET_REQUESTED");
    return { requested: true };
  },

  async resetPassword(token: string, newPassword: string) {
    const policy = passwordMeetsPolicy(newPassword);
    if (!policy.ok) throw new AppError(422, "WEAK_PASSWORD", policy.reason!);

    const tokenHash = hashOpaqueToken(token);
    const { rows } = await pool.query<{ id: string; user_id: string; expires_at: string; consumed_at: string | null }>(
      `SELECT * FROM password_resets WHERE token_hash = $1`,
      [tokenHash],
    );
    const record = rows[0];
    if (!record || record.consumed_at || new Date(record.expires_at) < new Date()) {
      throw new AppError(400, "INVALID_OR_EXPIRED_TOKEN", "This reset link is invalid or has expired.");
    }

    const passwordHash = await hashPassword(newPassword);
    await withTransaction(async (client) => {
      await client.query(`UPDATE password_resets SET consumed_at = now() WHERE id = $1`, [record.id]);
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, record.user_id]);
      // Resetting a password invalidates every existing session — a compromised
      // password shouldn't leave old sessions alive.
      await client.query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
        record.user_id,
      ]);
    });

    await audit(record.user_id, "PASSWORD_RESET_COMPLETED");
    return { reset: true };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const policy = passwordMeetsPolicy(newPassword);
    if (!policy.ok) throw new AppError(422, "WEAK_PASSWORD", policy.reason!);

    const user = await userRepository.findById(userId);
    if (!user) throw new AppError(404, "NOT_FOUND", "User not found.");

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) throw new AppError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");

    const passwordHash = await hashPassword(newPassword);
    await userRepository.updatePasswordHash(userId, passwordHash);
    await audit(userId, "PASSWORD_CHANGED");
    return { changed: true };
  },

  async deleteAccount(userId: string) {
    await withTransaction(async (client) => {
      await client.query(`UPDATE users SET deleted_at = now(), status = 'deleted' WHERE id = $1`, [userId]);
      await client.query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
        userId,
      ]);
    });
    await audit(userId, "ACCOUNT_DELETED");
    return { deleted: true };
  },
};
