import { pool } from "../../db/pool";

export interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  role: "user" | "moderator" | "admin" | "super_admin";
  status: "active" | "suspended" | "banned" | "deleted";
  email_verified_at: string | null;
  phone_verified_at: string | null;
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Fields safe to ever send to a client. Never spread the raw row. */
export function toPublicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    status: u.status,
    emailVerified: !!u.email_verified_at,
    phoneVerified: !!u.phone_verified_at,
    createdAt: u.created_at,
  };
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    return rows[0] ?? null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  },

  async create(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  }): Promise<UserRow> {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.email, input.passwordHash, input.firstName, input.lastName, input.dateOfBirth],
    );
    return rows[0];
  },

  async markEmailVerified(userId: string): Promise<void> {
    await pool.query(`UPDATE users SET email_verified_at = now() WHERE id = $1`, [userId]);
  },

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
  },

  async recordLoginSuccess(userId: string): Promise<void> {
    await pool.query(
      `UPDATE users SET last_login_at = now(), failed_login_count = 0, locked_until = NULL WHERE id = $1`,
      [userId],
    );
  },

  async recordLoginFailure(userId: string): Promise<void> {
    // Lock the account for 15 minutes after 5 consecutive failures.
    await pool.query(
      `UPDATE users
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE WHEN failed_login_count + 1 >= 5 THEN now() + INTERVAL '15 minutes' ELSE locked_until END
       WHERE id = $1`,
      [userId],
    );
  },

  async softDelete(userId: string): Promise<void> {
    await pool.query(
      `UPDATE users SET deleted_at = now(), status = 'deleted' WHERE id = $1`,
      [userId],
    );
  },
};
