import { pool, withTransaction } from "../../db/pool";

export const communitiesRepository = {
  async list(userId: string, search?: string, category?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [userId];
    let i = 2;
    if (search) {
      conditions.push(`(c.name ILIKE $${i} OR c.description ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (category) {
      conditions.push(`c.category = $${i}`);
      params.push(category);
      i++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description, c.category, c.member_count,
              (cm.user_id IS NOT NULL) AS joined
       FROM communities c
       LEFT JOIN community_members cm ON cm.community_id = c.id AND cm.user_id = $1
       ${where}
       ORDER BY c.member_count DESC, c.name`,
      params,
    );
    return rows;
  },

  async findById(id: string) {
    const { rows } = await pool.query(`SELECT * FROM communities WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async isMember(communityId: string, userId: string): Promise<boolean> {
    const { rows } = await pool.query(`SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2`, [
      communityId,
      userId,
    ]);
    return rows.length > 0;
  },

  async join(communityId: string, userId: string) {
    await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [communityId, userId],
      );
      if (rowCount) {
        await client.query(`UPDATE communities SET member_count = member_count + 1 WHERE id = $1`, [communityId]);
      }
    });
  },

  async leave(communityId: string, userId: string) {
    await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
        [communityId, userId],
      );
      if (rowCount) {
        await client.query(`UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1`, [
          communityId,
        ]);
      }
    });
  },

  async listPosts(communityId: string, userId: string, limit: number, offset: number) {
    const { rows } = await pool.query(
      `SELECT p.id, p.content, p.like_count, p.comment_count, p.created_at,
              p.author_id, u.first_name AS author_name,
              (pl.user_id IS NOT NULL) AS liked_by_me
       FROM community_posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN community_post_likes pl ON pl.post_id = p.id AND pl.user_id = $2
       WHERE p.community_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC
       LIMIT $3 OFFSET $4`,
      [communityId, userId, limit, offset],
    );
    return rows;
  },

  async createPost(communityId: string, authorId: string, content: string) {
    const { rows } = await pool.query(
      `INSERT INTO community_posts (community_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [communityId, authorId, content],
    );
    return rows[0];
  },

  async findPostById(postId: string) {
    const { rows } = await pool.query(`SELECT * FROM community_posts WHERE id = $1`, [postId]);
    return rows[0] ?? null;
  },

  async deletePost(postId: string) {
    await pool.query(`UPDATE community_posts SET deleted_at = now() WHERE id = $1`, [postId]);
  },

  async toggleLike(postId: string, userId: string): Promise<boolean> {
    return withTransaction(async (client) => {
      const { rows } = await client.query(`SELECT 1 FROM community_post_likes WHERE post_id = $1 AND user_id = $2`, [
        postId,
        userId,
      ]);
      if (rows.length > 0) {
        await client.query(`DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
        await client.query(`UPDATE community_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1`, [
          postId,
        ]);
        return false;
      }
      await client.query(`INSERT INTO community_post_likes (post_id, user_id) VALUES ($1, $2)`, [postId, userId]);
      await client.query(`UPDATE community_posts SET like_count = like_count + 1 WHERE id = $1`, [postId]);
      return true;
    });
  },

  async listComments(postId: string) {
    const { rows } = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.author_id, u.first_name AS author_name
       FROM community_post_comments c JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1 AND c.deleted_at IS NULL
       ORDER BY c.created_at ASC`,
      [postId],
    );
    return rows;
  },

  async addComment(postId: string, authorId: string, content: string) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO community_post_comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
        [postId, authorId, content],
      );
      await client.query(`UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = $1`, [postId]);
      return rows[0];
    });
  },
};
