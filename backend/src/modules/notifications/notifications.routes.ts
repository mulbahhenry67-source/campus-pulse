import { Router } from "express";
import { notificationsService } from "./notifications.service";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../utils/asyncHandler";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const [items, unreadCount] = await Promise.all([
      notificationsService.list(req.user!.id, limit, offset),
      notificationsService.unreadCount(req.user!.id),
    ]);
    res.json({ items, unreadCount });
  }),
);

notificationsRouter.post(
  "/:id/read",
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationsService.markRead(req.user!.id, req.params.id);
    res.status(204).send();
  }),
);

notificationsRouter.post(
  "/read-all",
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationsService.markAllRead(req.user!.id);
    res.status(204).send();
  }),
);
