import { Router } from "express";
import { z } from "zod";
import { adminService } from "./admin.service";
import { authenticate, requireRole } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";

export const adminRouter = Router();

// Every admin route requires at least moderator-level access.
adminRouter.use(authenticate, requireRole("moderator", "admin", "super_admin"));

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    res.json(await adminService.overview());
  }),
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Number(req.query.offset) || 0;
    const items = await adminService.listUsers(search, status, limit, offset);
    res.json({ items });
  }),
);

adminRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await adminService.getUser(req.params.id);
    res.json({ user });
  }),
);

const reasonSchema = z.object({ reason: z.string().trim().min(1).max(500) });

// Suspend/ban/restore are destructive enough to require admin, not just moderator.
adminRouter.post(
  "/users/:id/suspend",
  requireRole("admin", "super_admin"),
  validateBody(reasonSchema),
  asyncHandler(async (req, res) => {
    const user = await adminService.suspendUser(req.user!.id, req.params.id, req.body.reason);
    res.json({ user });
  }),
);

adminRouter.post(
  "/users/:id/ban",
  requireRole("admin", "super_admin"),
  validateBody(reasonSchema),
  asyncHandler(async (req, res) => {
    const user = await adminService.banUser(req.user!.id, req.params.id, req.body.reason);
    res.json({ user });
  }),
);

adminRouter.post(
  "/users/:id/restore",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const user = await adminService.restoreUser(req.user!.id, req.params.id);
    res.json({ user });
  }),
);

// ---- Reports queue (moderators can handle this) ----
adminRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const targetType = typeof req.query.targetType === "string" ? req.query.targetType : undefined;
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Number(req.query.offset) || 0;
    const items = await adminService.listReports(status, targetType, limit, offset);
    res.json({ items });
  }),
);

const reviewReportSchema = z.object({
  status: z.enum(["under_review", "resolved", "rejected"]),
  moderatorNotes: z.string().max(1000).optional(),
});

adminRouter.post(
  "/reports/:id/review",
  validateBody(reviewReportSchema),
  asyncHandler(async (req, res) => {
    const report = await adminService.reviewReport(req.user!.id, req.params.id, req.body.status, req.body.moderatorNotes);
    res.json({ report });
  }),
);

// ---- Verification review (moderators can handle this) ----
adminRouter.get(
  "/verification-requests",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Number(req.query.offset) || 0;
    const items = await adminService.listVerificationRequests(status, limit, offset);
    res.json({ items });
  }),
);

const verificationDecisionSchema = z.object({ notes: z.string().max(1000).optional() });

adminRouter.post(
  "/verification-requests/:id/approve",
  validateBody(verificationDecisionSchema),
  asyncHandler(async (req, res) => {
    const result = await adminService.decideVerification(req.user!.id, req.params.id, true, req.body.notes);
    res.json({ request: result });
  }),
);

adminRouter.post(
  "/verification-requests/:id/reject",
  validateBody(verificationDecisionSchema),
  asyncHandler(async (req, res) => {
    const result = await adminService.decideVerification(req.user!.id, req.params.id, false, req.body.notes);
    res.json({ request: result });
  }),
);
