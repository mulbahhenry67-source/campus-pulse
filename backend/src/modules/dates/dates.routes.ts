import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { messagesRepository } from "../messages/messages.repository";
import { notificationsRepository } from "../notifications/notifications.service";
import { connectionHub } from "../../ws/hub";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../middleware/errorHandler";

const ACTIVITIES = ["coffee", "restaurant", "walk", "study_session", "gaming", "sports", "movie", "campus_event", "other"] as const;

const proposeSchema = z
  .object({
    activity: z.enum(ACTIVITIES),
    customActivity: z.string().max(100).optional(),
    proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "proposedDate must be YYYY-MM-DD"),
    proposedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "proposedTime must be HH:MM"),
    locationNote: z.string().max(300).optional(),
  })
  .refine((v) => v.activity !== "other" || !!v.customActivity, {
    message: "customActivity is required when activity is 'other'.",
    path: ["customActivity"],
  });

export const datePlansRepository = {
  async create(matchId: string, proposedBy: string, input: z.infer<typeof proposeSchema>) {
    const { rows } = await pool.query(
      `INSERT INTO date_plans (match_id, proposed_by, activity, custom_activity, proposed_date, proposed_time, location_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [matchId, proposedBy, input.activity, input.customActivity ?? null, input.proposedDate, input.proposedTime, input.locationNote ?? null],
    );
    return rows[0];
  },

  async listForMatch(matchId: string) {
    const { rows } = await pool.query(`SELECT * FROM date_plans WHERE match_id = $1 ORDER BY created_at DESC`, [matchId]);
    return rows;
  },

  async findById(id: string) {
    const { rows } = await pool.query(`SELECT * FROM date_plans WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async setStatus(id: string, status: string, fields: Partial<{ confirmed_by_recipient: boolean }> = {}) {
    const sets = [`status = $2`];
    const values: unknown[] = [id, status];
    let i = 3;
    for (const [key, value] of Object.entries(fields)) {
      sets.push(`${key} = $${i++}`);
      values.push(value);
    }
    const { rows } = await pool.query(`UPDATE date_plans SET ${sets.join(", ")} WHERE id = $1 RETURNING *`, values);
    return rows[0];
  },
};

async function assertParticipant(matchId: string, userId: string) {
  const isParticipant = await messagesRepository.isActiveParticipant(matchId, userId);
  if (!isParticipant) throw new AppError(403, "NOT_A_PARTICIPANT", "You're not part of this match.");
}

export const datePlansService = {
  async propose(matchId: string, userId: string, input: z.infer<typeof proposeSchema>) {
    await assertParticipant(matchId, userId);
    const plan = await datePlansRepository.create(matchId, userId, input);

    const otherUserId = await messagesRepository.getOtherParticipant(matchId, userId);
    if (otherUserId) {
      await notificationsRepository.create(otherUserId, "date_invitation", { matchId, planId: plan.id });
      connectionHub.pushToUser(otherUserId, { type: "date_plan:new", matchId, plan });
    }
    return plan;
  },

  list: (matchId: string, userId: string) => assertParticipant(matchId, userId).then(() => datePlansRepository.listForMatch(matchId)),

  async respond(planId: string, userId: string, action: "confirm" | "decline" | "cancel") {
    const plan = await datePlansRepository.findById(planId);
    if (!plan) throw new AppError(404, "PLAN_NOT_FOUND", "Date plan not found.");
    await assertParticipant(plan.match_id, userId);

    let updated;
    if (action === "confirm") {
      if (plan.proposed_by === userId) throw new AppError(400, "CANNOT_CONFIRM_OWN", "The other person needs to confirm this plan.");
      updated = await datePlansRepository.setStatus(planId, "confirmed", { confirmed_by_recipient: true });
      const otherUserId = await messagesRepository.getOtherParticipant(plan.match_id, userId);
      if (otherUserId) {
        await notificationsRepository.create(otherUserId, "date_confirmation", { matchId: plan.match_id, planId });
        connectionHub.pushToUser(otherUserId, { type: "date_plan:confirmed", matchId: plan.match_id, plan: updated });
      }
    } else if (action === "decline") {
      updated = await datePlansRepository.setStatus(planId, "declined");
    } else {
      updated = await datePlansRepository.setStatus(planId, "cancelled");
    }
    return updated;
  },
};

export const datePlansRouter = Router({ mergeParams: true });

datePlansRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const items = await datePlansService.list(req.params.matchId, req.user!.id);
    res.json({ items });
  }),
);

datePlansRouter.post(
  "/",
  authenticate,
  validateBody(proposeSchema),
  asyncHandler(async (req, res) => {
    const plan = await datePlansService.propose(req.params.matchId, req.user!.id, req.body);
    res.status(201).json({ plan });
  }),
);

export const datePlanActionsRouter = Router();

for (const action of ["confirm", "decline", "cancel"] as const) {
  datePlanActionsRouter.post(
    `/:id/${action}`,
    authenticate,
    asyncHandler(async (req, res) => {
      const plan = await datePlansService.respond(req.params.id, req.user!.id, action);
      res.json({ plan });
    }),
  );
}
