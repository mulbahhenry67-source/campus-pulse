import { pool } from "../../db/pool";

export const notificationsRepository = {
  async create(userId: string, type: string, payload: Record<string, unknown>) {
    await pool.query(`INSERT INTO notifications (user_id, type, payload) VALUES ($1, $2, $3)`, [
      userId,
      type,
      JSON.stringify(payload),
    ]);
  },

  async list(userId: string, limit: number, offset: number) {
    const { rows } = await pool.query(
      `SELECT id, type, payload, read_at, created_at FROM notifications
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return rows;
  },

  async unreadCount(userId: string): Promise<number> {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return Number(rows[0].count);
  },

  async markRead(userId: string, notificationId: string) {
    await pool.query(`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`, [
      notificationId,
      userId,
    ]);
  },

  async markAllRead(userId: string) {
    await pool.query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
  },
};

export const notificationsService = {
  async notifyMatch(userAId: string, userBId: string, matchId: string) {
    await Promise.all([
      notificationsRepository.create(userAId, "new_match", { matchId, withUserId: userBId }),
      notificationsRepository.create(userBId, "new_match", { matchId, withUserId: userAId }),
    ]);
  },

  async notifyLike(likerId: string, likedId: string, isSuperLike: boolean) {
    await notificationsRepository.create(likedId, isSuperLike ? "super_like" : "new_like", {
      fromUserId: likerId,
    });
  },

  async list(userId: string, limit: number, offset: number) {
    return notificationsRepository.list(userId, limit, offset);
  },

  async unreadCount(userId: string) {
    return notificationsRepository.unreadCount(userId);
  },

  async markRead(userId: string, notificationId: string) {
    await notificationsRepository.markRead(userId, notificationId);
  },

  async markAllRead(userId: string) {
    await notificationsRepository.markAllRead(userId);
  },
};
