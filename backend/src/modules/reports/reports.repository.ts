import { pool } from "../../db/pool";

export type ReportTargetType = "message" | "user" | "community_post" | "community";
export type ReportReason =
  | "harassment"
  | "spam"
  | "fake_profile"
  | "scam"
  | "inappropriate_content"
  | "impersonation"
  | "other";

export const reportsRepository = {
  async create(input: {
    reporterId: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    description?: string;
  }) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.reporterId, input.targetType, input.targetId, input.reason, input.description ?? null],
    );
    return rows[0].id;
  },
};
