import { Router } from "express";
import { messagesService } from "./messages.service";
import { sendMessageSchema, reactionSchema, reportMessageSchema } from "./messages.validators";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";

export const conversationsRouter = Router();
export const messagesRouter = Router();

// ---- Conversation list (mounted at /api/conversations) ----
conversationsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const items = await messagesService.listConversations(req.user!.id);
    res.json({ items });
  }),
);

conversationsRouter.get(
  "/search",
  authenticate,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ items: [] });
    const items = await messagesService.searchConversations(req.user!.id, q);
    res.json({ items });
  }),
);

conversationsRouter.get(
  "/:matchId/messages",
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const items = await messagesService.listMessages(req.params.matchId, req.user!.id, limit, before);
    res.json({ items });
  }),
);

conversationsRouter.post(
  "/:matchId/messages",
  authenticate,
  validateBody(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const message = await messagesService.send(
      req.params.matchId,
      req.user!.id,
      req.body.content ?? null,
      req.body.imageUrl ?? null,
    );
    res.status(201).json({ message });
  }),
);

conversationsRouter.post(
  "/:matchId/read",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await messagesService.markRead(req.params.matchId, req.user!.id);
    res.json(result);
  }),
);

// ---- Individual message actions (mounted at /api/messages) ----
messagesRouter.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await messagesService.deleteMessage(req.params.id, req.user!.id);
    res.json(result);
  }),
);

messagesRouter.put(
  "/:id/reactions",
  authenticate,
  validateBody(reactionSchema),
  asyncHandler(async (req, res) => {
    const result = await messagesService.react(req.params.id, req.user!.id, req.body.emoji);
    res.json(result);
  }),
);

messagesRouter.delete(
  "/:id/reactions",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await messagesService.removeReaction(req.params.id, req.user!.id);
    res.json(result);
  }),
);

messagesRouter.post(
  "/:id/report",
  authenticate,
  validateBody(reportMessageSchema),
  asyncHandler(async (req, res) => {
    const result = await messagesService.reportMessage(
      req.user!.id,
      req.params.id,
      req.body.reason,
      req.body.description,
    );
    res.status(201).json(result);
  }),
);
