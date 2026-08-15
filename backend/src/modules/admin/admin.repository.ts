import { pool } from "../../db/pool";

export const adminRepository = {
  async overview() {
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      verifiedUsers,
      totalMatches,
      totalMessages,
      pendingReports,
      suspendedUsers,
      deletedAccounts,
      communityPosts,
    ] = await Promise.all([
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`),
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND status = 'active'`),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND created_at >= date_trunc('day', now())`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND (email_verified_at IS NOT NULL OR student_verified_at IS NOT NULL)`,
      ),
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM matches WHERE unmatched_at IS NULL`),
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM messages WHERE deleted_at IS NULL`),
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM reports WHERE status = 'pending'`),
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM users WHERE status = 'suspended'`),
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL`),
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM community_posts WHERE deleted_at IS NULL`),
    ]);

    return {
      totalUsers: Number(totalUsers.rows[0].count),
      activeUsers: Number(activeUsers.rows[0].count),
      newUsersToday: Number(newUsersToday.rows[0].count),
      verifiedUsers: Number(verifiedUsers.rows[0].count),
      totalMatches: Number(totalMatches.rows[0].count),
      totalMessages: Number(totalMessages.rows[0].count),
      pendingReports: Number(pendingReports.rows[0].count),
      suspendedUsers: Number(suspendedUsers.rows[0].count),
      deletedAccounts: Number(deletedAccounts.rows[0].count),
      communityPosts: Number(communityPosts.rows[0].count),
    };
  },

  async listUsers(search: string | undefined, status: string | undefined, limit: number, offset: number) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (search) {
      conditions.push(`(email ILIKE $${i} OR first_name ILIKE $${i} OR last_name ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (status) {
      conditions.push(`status = $${i++}`);
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, role, status, email_verified_at, student_verified_at, created_at, deleted_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      params,
    );
    return rows;
  },

  async getUserDetail(userId: string) {
    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, role, status, suspended_reason,
              email_verified_at, student_verified_at, created_at, last_login_at, deleted_at
       FROM users WHERE id = $1`,
      [userId],
    );
    const user = rows[0] ?? null;
    if (!user) return null;

    const [reportsAgainst, reportsBy] = await Promise.all([
      pool.query(
        `SELECT id, target_type, reason, description, status, created_at FROM reports
         WHERE target_type = 'user' AND target_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [userId],
      ),
      pool.query<{ count: string }>(`SELECT COUNT(*) FROM reports WHERE reporter_id = $1`, [userId]),
    ]);

    return { ...user, reportsAgainst: reportsAgainst.rows, reportsFiledCount: Number(reportsBy.rows[0].count) };
  },

  async setStatus(userId: string, status: string, reason: string | null) {
    const { rows } = await pool.query(
      `UPDATE users SET status = $2, suspended_reason = $3 WHERE id = $1 RETURNING id, status`,
      [userId, status, reason],
    );
    return rows[0];
  },

  async revokeAllSessions(userId: string) {
    await pool.query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
  },

  async listReports(status: string | undefined, targetType: string | undefined, limit: number, offset: number) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (status) {
      conditions.push(`r.status = $${i++}`);
      params.push(status);
    }
    if (targetType) {
      conditions.push(`r.target_type = $${i++}`);
      params.push(targetType);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.description, r.status,
              r.moderator_notes, r.created_at, r.resolved_at,
              u.first_name AS reporter_name, u.email AS reporter_email
       FROM reports r JOIN users u ON u.id = r.reporter_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      params,
    );
    return rows;
  },

  async reviewReport(reportId: string, reviewerId: string, status: string, notes: string | undefined) {
    const { rows } = await pool.query(
      `UPDATE reports SET status = $2, moderator_notes = $3, resolved_by = $4, resolved_at = now()
       WHERE id = $1 RETURNING *`,
      [reportId, status, notes ?? null, reviewerId],
    );
    return rows[0];
  },

  async listVerificationRequests(status: string | undefined, limit: number, offset: number) {
    const where = status ? `WHERE v.status = $1` : "";
    const params: unknown[] = status ? [status, limit, offset] : [limit, offset];
    const limitIdx = status ? 2 : 1;

    const { rows } = await pool.query(
      `SELECT v.id, v.method, v.school_email, v.student_id_image_url, v.status, v.reviewer_notes, v.created_at,
              u.id AS user_id, u.first_name, u.last_name, u.email
       FROM verification_requests v JOIN users u ON u.id = v.user_id
       ${where}
       ORDER BY v.created_at ASC
       LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
      params,
    );
    return rows;
  },

  async findVerificationRequest(id: string) {
    const { rows } = await pool.query(`SELECT * FROM verification_requests WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async decideVerification(id: string, reviewerId: string, approve: boolean, notes: string | undefined) {
    const request = await this.findVerificationRequest(id);
    if (!request) return null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `UPDATE verification_requests SET status = $2, reviewed_by = $3, reviewer_notes = $4, reviewed_at = now()
         WHERE id = $1 RETURNING *`,
        [id, approve ? "approved" : "rejected", reviewerId, notes ?? null],
      );
      if (approve) {
        await client.query(`UPDATE users SET student_verified_at = now() WHERE id = $1`, [request.user_id]);
      }
      await client.query("COMMIT");
      return rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async auditLog(userId: string, eventType: string, metadata: Record<string, unknown>) {
    await pool.query(`INSERT INTO audit_logs (user_id, event_type, metadata) VALUES ($1, $2, $3)`, [
      userId,
      eventType,
      JSON.stringify(metadata),
    ]);
  },
};
