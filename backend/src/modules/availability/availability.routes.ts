import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../middleware/errorHandler";

const blockSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime must be HH:MM (24h)"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "endTime must be HH:MM (24h)"),
});

const replaceAllSchema = z.object({
  blocks: z.array(blockSchema).max(50),
});

export const availabilityRepository = {
  async listForUser(userId: string) {
    const { rows } = await pool.query(
      `SELECT id, day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime"
       FROM availability WHERE user_id = $1 ORDER BY day_of_week, start_time`,
      [userId],
    );
    return rows;
  },

  /** Replaces the user's entire weekly availability in one transaction — simpler and safer
   *  for the client than diffing individual blocks. */
  async replaceAll(userId: string, blocks: { dayOfWeek: number; startTime: string; endTime: string }[]) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM availability WHERE user_id = $1`, [userId]);
      for (const b of blocks) {
        if (b.startTime >= b.endTime) {
          throw new AppError(422, "VALIDATION_ERROR", "Each block's start time must be before its end time.");
        }
        await client.query(
          `INSERT INTO availability (user_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)`,
          [userId, b.dayOfWeek, b.startTime, b.endTime],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};

export const availabilityRouter = Router();

availabilityRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const items = await availabilityRepository.listForUser(req.user!.id);
    res.json({ items });
  }),
);

availabilityRouter.put(
  "/",
  authenticate,
  validateBody(replaceAllSchema),
  asyncHandler(async (req, res) => {
    await availabilityRepository.replaceAll(req.user!.id, req.body.blocks);
    const items = await availabilityRepository.listForUser(req.user!.id);
    res.json({ items });
  }),
);
