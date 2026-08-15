import { Router } from "express";
import { z } from "zod";
import { likesService } from "./likes.service";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";

export const likesRouter = Router();

const targetSchema = z.object({
  userId: z.string().uuid(),
  isSuperLike: z.boolean().optional().default(false),
});

const passSchema = z.object({ userId: z.string().uuid() });

likesRouter.post(
  "/",
  authenticate,
  validateBody(targetSchema),
  asyncHandler(async (req, res) => {
    const result = await likesService.like(req.user!.id, req.body.userId, req.body.isSuperLike);
    res.status(201).json(result);
  }),
);

likesRouter.post(
  "/pass",
  authenticate,
  validateBody(passSchema),
  asyncHandler(async (req, res) => {
    const result = await likesService.pass(req.user!.id, req.body.userId);
    res.json(result);
  }),
);

likesRouter.get(
  "/received",
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const items = await likesService.getReceivedLikes(req.user!.id, limit, offset);
    res.json({ items });
  }),
);
