import { Router } from "express";
import { pool } from "../../db/pool";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../middleware/errorHandler";

export const matchesRepository = {
  async listForUser(userId: string) {
    const { rows } = await pool.query(
      `SELECT
         m.id,
         CASE WHEN m.user_low_id = $1 THEN m.user_high_id ELSE m.user_low_id END AS other_user_id,
         m.matched_at,
         u.first_name,
         (SELECT url FROM profile_photos ph WHERE ph.user_id = u.id ORDER BY ph.is_primary DESC, ph.position ASC LIMIT 1) AS photo_url
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.user_low_id = $1 THEN m.user_high_id ELSE m.user_low_id END
       WHERE (m.user_low_id = $1 OR m.user_high_id = $1) AND m.unmatched_at IS NULL
       ORDER BY m.matched_at DESC`,
      [userId],
    );
    return rows;
  },

  async findById(matchId: string) {
    const { rows } = await pool.query(`SELECT * FROM matches WHERE id = $1`, [matchId]);
    return rows[0] ?? null;
  },

  async unmatch(matchId: string, byUserId: string) {
    await pool.query(`UPDATE matches SET unmatched_at = now(), unmatched_by = $1 WHERE id = $2`, [
      byUserId,
      matchId,
    ]);
  },
};

export const matchesService = {
  async list(userId: string) {
    return matchesRepository.listForUser(userId);
  },

  async unmatch(userId: string, matchId: string) {
    const match = await matchesRepository.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND", "Match not found.");
    if (match.user_low_id !== userId && match.user_high_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "You're not part of this match.");
    }
    if (match.unmatched_at) throw new AppError(409, "ALREADY_UNMATCHED", "This match no longer exists.");
    await matchesRepository.unmatch(matchId, userId);
    return { unmatched: true };
  },
};

export const matchesRouter = Router();

matchesRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const items = await matchesService.list(req.user!.id);
    res.json({ items });
  }),
);

matchesRouter.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await matchesService.unmatch(req.user!.id, req.params.id);
    res.json(result);
  }),
);
