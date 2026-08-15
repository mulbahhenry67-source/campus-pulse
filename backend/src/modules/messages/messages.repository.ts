import { pool, withTransaction } from "../../db/pool";

export interface MessageRow {
  id: string;
  match_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
}

export const messagesRepository = {
  async isActiveParticipant(matchId: string, userId: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM matches WHERE id = $1 AND (user_low_id = $2 OR user_high_id = $2) AND unmatched_at IS NULL`,
      [matchId, userId],
    );
    return rows.length > 0;
  },

  async getOtherParticipant(matchId: string, userId: string): Promise<string | null> {
    const { rows } = await pool.query<{ other_id: string }>(
      `SELECT CASE WHEN user_low_id = $2 THEN user_high_id ELSE user_low_id END AS other_id
       FROM matches WHERE id = $1`,
      [matchId, userId],
    );
    return rows[0]?.other_id ?? null;
  },

  async areBlocked(userA: string, userB: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [userA, userB],
    );
    return rows.length > 0;
  },

  async send(matchId: string, senderId: string, content: string | null, imageUrl: string | null): Promise<MessageRow> {
    return withTransaction(async (client) => {
      const { rows } = await client.query<MessageRow>(
        `INSERT INTO messages (match_id, sender_id, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *`,
        [matchId, senderId, content, imageUrl],
      );
      await client.query(`UPDATE matches SET last_message_at = now() WHERE id = $1`, [matchId]);
      return rows[0];
    });
  },

  async listForMatch(matchId: string, limit: number, before?: string) {
    const params: unknown[] = [matchId];
    let cursorClause = "";
    if (before) {
      params.push(before);
      cursorClause = `AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
    }
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT
         m.id, m.sender_id, m.content, m.image_url, m.created_at, m.deleted_at,
         COALESCE(
           json_agg(json_build_object('emoji', r.emoji, 'userId', r.user_id)) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) AS reactions
       FROM messages m
       LEFT JOIN message_reactions r ON r.message_id = m.id
       WHERE m.match_id = $1 ${cursorClause}
       GROUP BY m.id
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.reverse(); // chronological order for the client
  },

  async findById(id: string): Promise<MessageRow | null> {
    const { rows } = await pool.query<MessageRow>(`SELECT * FROM messages WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async softDelete(messageId: string) {
    await pool.query(`UPDATE messages SET deleted_at = now(), content = NULL, image_url = NULL WHERE id = $1`, [
      messageId,
    ]);
  },

  async upsertReaction(messageId: string, userId: string, emoji: string) {
    await pool.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = $3, created_at = now()`,
      [messageId, userId, emoji],
    );
  },

  async removeReaction(messageId: string, userId: string) {
    await pool.query(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
  },

  async markRead(matchId: string, userId: string) {
    await pool.query(
      `INSERT INTO message_reads (match_id, user_id, last_read_at) VALUES ($1, $2, now())
       ON CONFLICT (match_id, user_id) DO UPDATE SET last_read_at = now()`,
      [matchId, userId],
    );
  },

  async getUnreadCount(matchId: string, userId: string): Promise<number> {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM messages m
       WHERE m.match_id = $1 AND m.sender_id <> $2 AND m.deleted_at IS NULL
         AND m.created_at > COALESCE(
           (SELECT last_read_at FROM message_reads WHERE match_id = $1 AND user_id = $2),
           '1970-01-01'::timestamptz
         )`,
      [matchId, userId],
    );
    return Number(rows[0].count);
  },

  /** Conversation list: every active match for a user, with last message preview + unread count. */
  async listConversations(userId: string) {
    const { rows } = await pool.query(
      `SELECT
         mt.id AS match_id,
         CASE WHEN mt.user_low_id = $1 THEN mt.user_high_id ELSE mt.user_low_id END AS other_user_id,
         u.first_name,
         (SELECT url FROM profile_photos ph WHERE ph.user_id = u.id ORDER BY ph.is_primary DESC, ph.position ASC LIMIT 1) AS photo_url,
         mt.last_message_at,
         (SELECT json_build_object('content', lm.content, 'imageUrl', lm.image_url, 'senderId', lm.sender_id, 'createdAt', lm.created_at)
          FROM messages lm WHERE lm.match_id = mt.id AND lm.deleted_at IS NULL ORDER BY lm.created_at DESC LIMIT 1) AS last_message,
         (SELECT COUNT(*) FROM messages um WHERE um.match_id = mt.id AND um.sender_id <> $1 AND um.deleted_at IS NULL
            AND um.created_at > COALESCE((SELECT last_read_at FROM message_reads WHERE match_id = mt.id AND user_id = $1), '1970-01-01'::timestamptz)
         ) AS unread_count
       FROM matches mt
       JOIN users u ON u.id = CASE WHEN mt.user_low_id = $1 THEN mt.user_high_id ELSE mt.user_low_id END
       WHERE (mt.user_low_id = $1 OR mt.user_high_id = $1) AND mt.unmatched_at IS NULL
       ORDER BY mt.last_message_at DESC`,
      [userId],
    );
    return rows;
  },

  async searchConversations(userId: string, query: string) {
    const { rows } = await pool.query(
      `SELECT DISTINCT
         mt.id AS match_id,
         CASE WHEN mt.user_low_id = $1 THEN mt.user_high_id ELSE mt.user_low_id END AS other_user_id,
         u.first_name,
         mt.last_message_at
       FROM matches mt
       JOIN users u ON u.id = CASE WHEN mt.user_low_id = $1 THEN mt.user_high_id ELSE mt.user_low_id END
       LEFT JOIN messages m ON m.match_id = mt.id AND m.deleted_at IS NULL
       WHERE (mt.user_low_id = $1 OR mt.user_high_id = $1) AND mt.unmatched_at IS NULL
         AND (u.first_name ILIKE $2 OR m.content ILIKE $2)
       ORDER BY mt.last_message_at DESC
       LIMIT 30`,
      [userId, `%${query}%`],
    );
    return rows;
  },
};
