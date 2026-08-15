import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../middleware/errorHandler";

const requestSchema = z
  .object({
    method: z.enum(["school_email", "student_id"]),
    schoolEmail: z.string().email().optional(),
    studentIdImageUrl: z.string().url().optional(),
  })
  .refine((v) => (v.method === "school_email" ? !!v.schoolEmail : !!v.studentIdImageUrl), {
    message: "schoolEmail is required for the school_email method; studentIdImageUrl is required for student_id.",
  });

export const verificationRepository = {
  async create(userId: string, method: string, schoolEmail?: string, studentIdImageUrl?: string) {
    const { rows } = await pool.query(
      `INSERT INTO verification_requests (user_id, method, school_email, student_id_image_url)
       VALUES ($1, $2, $3, $4) RETURNING id, method, status, created_at`,
      [userId, method, schoolEmail ?? null, studentIdImageUrl ?? null],
    );
    return rows[0];
  },

  async latestForUser(userId: string) {
    const { rows } = await pool.query(
      `SELECT id, method, status, reviewer_notes, created_at, reviewed_at
       FROM verification_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  },
};

export const verificationRouter = Router();

verificationRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const latest = await verificationRepository.latestForUser(req.user!.id);
    res.json({ request: latest });
  }),
);

verificationRouter.post(
  "/request",
  authenticate,
  validateBody(requestSchema),
  asyncHandler(async (req, res) => {
    const existing = await verificationRepository.latestForUser(req.user!.id);
    if (existing?.status === "pending") {
      throw new AppError(409, "REQUEST_ALREADY_PENDING", "You already have a verification request pending review.");
    }
    const request = await verificationRepository.create(
      req.user!.id,
      req.body.method,
      req.body.schoolEmail,
      req.body.studentIdImageUrl,
    );
    res.status(201).json({ request });
  }),
);
