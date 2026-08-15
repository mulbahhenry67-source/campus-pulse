import { likesRepository } from "./likes.repository";
import { notificationsService } from "../notifications/notifications.service";
import { AppError } from "../../middleware/errorHandler";
import { pool } from "../../db/pool";

export const likesService = {
  async like(likerId: string, likedId: string, isSuperLike: boolean) {
    if (likerId === likedId) {
      throw new AppError(400, "INVALID_TARGET", "You can't like your own profile.");
    }

    const { rows } = await pool.query(`SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL`, [likedId]);
    if (rows.length === 0) {
      throw new AppError(404, "USER_NOT_FOUND", "This profile no longer exists.");
    }

    const { isMutual, matchId } = await likesRepository.likeAndCheckMatch(likerId, likedId, isSuperLike);

    if (isMutual && matchId) {
      await notificationsService.notifyMatch(likerId, likedId, matchId);
      return { matched: true, matchId };
    }

    await notificationsService.notifyLike(likerId, likedId, isSuperLike);
    return { matched: false, matchId: null };
  },

  async pass(userId: string, passedUserId: string) {
    if (userId === passedUserId) {
      throw new AppError(400, "INVALID_TARGET", "You can't pass on your own profile.");
    }
    await likesRepository.createPass(userId, passedUserId);
    return { passed: true };
  },

  async getReceivedLikes(userId: string, limit: number, offset: number) {
    return likesRepository.getReceivedLikes(userId, limit, offset);
  },
};
