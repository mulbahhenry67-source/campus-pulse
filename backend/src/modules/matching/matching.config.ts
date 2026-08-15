import { pool } from "../../db/pool";
import { MatchingWeights, DEFAULT_WEIGHTS } from "./matching.algorithm";
import { AppError } from "../../middleware/errorHandler";

interface ConfigRow {
  personality_weight: string;
  interests_weight: string;
  goals_weight: string;
  lifestyle_weight: string;
  education_weight: string;
  schedule_weight: string;
  distance_weight: string;
}

export const matchingConfigService = {
  /** Loaded fresh per-request rather than cached in-process, so admin changes apply immediately. */
  async getWeights(): Promise<MatchingWeights> {
    const { rows } = await pool.query<ConfigRow>(`SELECT * FROM matching_config WHERE id = 1`);
    if (!rows[0]) return DEFAULT_WEIGHTS;
    const r = rows[0];
    return {
      personality: Number(r.personality_weight),
      interests: Number(r.interests_weight),
      goals: Number(r.goals_weight),
      lifestyle: Number(r.lifestyle_weight),
      education: Number(r.education_weight),
      schedule: Number(r.schedule_weight),
      distance: Number(r.distance_weight),
    };
  },

  /** Admin-only. Weights need not sum to exactly 1.0 — the algorithm normalizes by the sum. */
  async updateWeights(partial: Partial<MatchingWeights>): Promise<MatchingWeights> {
    for (const [key, value] of Object.entries(partial)) {
      if (typeof value !== "number" || value < 0 || value > 1 || Number.isNaN(value)) {
        throw new AppError(422, "VALIDATION_ERROR", `Invalid weight for "${key}": must be a number between 0 and 1.`);
      }
    }

    const columnMap: Record<keyof MatchingWeights, string> = {
      personality: "personality_weight",
      interests: "interests_weight",
      goals: "goals_weight",
      lifestyle: "lifestyle_weight",
      education: "education_weight",
      schedule: "schedule_weight",
      distance: "distance_weight",
    };

    const sets: string[] = [];
    const values: number[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(partial)) {
      sets.push(`${columnMap[key as keyof MatchingWeights]} = $${i++}`);
      values.push(value as number);
    }
    if (sets.length === 0) return this.getWeights();

    await pool.query(`UPDATE matching_config SET ${sets.join(", ")} WHERE id = 1`, values);
    return this.getWeights();
  },
};
