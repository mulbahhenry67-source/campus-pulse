import { PoolClient } from "pg";
import { pool, withTransaction } from "../../db/pool";

export const likesRepository = {
  async hasLiked(likerId: string, likedId: string): Promise<boolean> {
    const { rows } = await pool.query(`SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = $2`, [
      likerId,
      likedId,
    ]);
    return rows.length > 0;
  },

  async createLike(client: PoolClient, likerId: string, likedId: string, isSuperLike: boolean) {
    await client.query(
      `INSERT INTO likes (liker_id, liked_id, is_super_like) VALUES ($1, $2, $3)
       ON CONFLICT (liker_id, liked_id) DO NOTHING`,
      [likerId, likedId, isSuperLike],
    );
  },

  async createPass(userId: string, passedUserId: string) {
    await pool.query(
      `INSERT INTO passes (user_id, passed_user_id) VALUES ($1, $2) ON CONFLICT (user_id, passed_user_id) DO NOTHING`,
      [userId, passedUserId],
    );
  },

  async createMatch(client: PoolClient, userA: string, userB: string): Promise<string> {
    const [low, high] = [userA, userB].sort();
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO matches (user_low_id, user_high_id) VALUES ($1, $2)
       ON CONFLICT (user_low_id, user_high_id) DO UPDATE SET matched_at = matches.matched_at
       RETURNING id`,
      [low, high],
    );
    return rows[0].id;
  },

  /**
   * Attempts to like a user, and atomically creates a match if the other
   * person already liked them back. Wrapped in a transaction so two
   * simultaneous mutual likes can't race into duplicate matches.
   */
  async likeAndCheckMatch(likerId: string, likedId: string, isSuperLike: boolean) {
    return withTransaction(async (client) => {
      await this.createLike(client, likerId, likedId, isSuperLike);

      const { rows: reciprocalRows } = await client.query(
        `SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = $2`,
        [likedId, likerId],
      );
      const isMutual = reciprocalRows.length > 0;

      let matchId: string | null = null;
      if (isMutual) {
        matchId = await this.createMatch(client, likerId, likedId);
      }

      return { isMutual, matchId };
    });
  },

  async getReceivedLikes(userId: string, limit: number, offset: number) {
    const { rows } = await pool.query(
      `SELECT l.liker_id AS user_id, l.is_super_like, l.created_at, u.first_name,
              (SELECT url FROM profile_photos ph WHERE ph.user_id = l.liker_id ORDER BY ph.is_primary DESC, ph.position ASC LIMIT 1) AS photo_url
       FROM likes l
       JOIN users u ON u.id = l.liker_id
       WHERE l.liked_id = $1
         AND NOT EXISTS (SELECT 1 FROM likes l2 WHERE l2.liker_id = $1 AND l2.liked_id = l.liker_id)
       ORDER BY l.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return rows;
  },
};
