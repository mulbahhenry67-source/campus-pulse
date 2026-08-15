import { pool } from "../../db/pool";
import { MatchCandidate, AvailabilityBlock } from "./matching.algorithm";

interface ProfileRow {
  user_id: string;
  personality: Record<string, number>;
  lifestyle: Record<string, string>;
  relationship_goal: string | null;
  school_id: string | null;
  major_id: string | null;
  latitude: number | null;
  longitude: number | null;
  max_distance_km: number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export const matchingRepository = {
  /** Builds the full scoring input for one user. Returns null if they have no profile yet. */
  async getCandidate(userId: string): Promise<MatchCandidate | null> {
    const { rows: profileRows } = await pool.query<ProfileRow>(
      `SELECT user_id, personality, lifestyle, relationship_goal, school_id, major_id, latitude, longitude, max_distance_km
       FROM profiles WHERE user_id = $1`,
      [userId],
    );
    const profile = profileRows[0];
    if (!profile) return null;

    const { rows: interestRows } = await pool.query<{ id: string; name: string }>(
      `SELECT i.id, i.name FROM user_interests ui JOIN interests i ON i.id = ui.interest_id WHERE ui.user_id = $1`,
      [userId],
    );

    const { rows: availRows } = await pool.query<{ day_of_week: number; start_time: string; end_time: string }>(
      `SELECT day_of_week, start_time, end_time FROM availability WHERE user_id = $1`,
      [userId],
    );

    const availability: AvailabilityBlock[] = availRows.map((r) => ({
      dayOfWeek: r.day_of_week,
      startMinutes: timeToMinutes(r.start_time),
      endMinutes: timeToMinutes(r.end_time),
    }));

    return {
      userId,
      personality: profile.personality ?? {},
      interestIds: interestRows.map((r) => r.id),
      interestNames: interestRows.map((r) => r.name),
      relationshipGoal: profile.relationship_goal,
      lifestyle: profile.lifestyle ?? {},
      schoolId: profile.school_id,
      majorId: profile.major_id,
      latitude: profile.latitude,
      longitude: profile.longitude,
      maxDistanceKm: profile.max_distance_km,
      availability,
    };
  },

  /** Batch version, for scoring a whole discovery feed without N round-trips per candidate. */
  async getCandidates(userIds: string[]): Promise<Map<string, MatchCandidate>> {
    if (userIds.length === 0) return new Map();

    const { rows: profileRows } = await pool.query<ProfileRow>(
      `SELECT user_id, personality, lifestyle, relationship_goal, school_id, major_id, latitude, longitude, max_distance_km
       FROM profiles WHERE user_id = ANY($1)`,
      [userIds],
    );

    const { rows: interestRows } = await pool.query<{ user_id: string; id: string; name: string }>(
      `SELECT ui.user_id, i.id, i.name FROM user_interests ui JOIN interests i ON i.id = ui.interest_id WHERE ui.user_id = ANY($1)`,
      [userIds],
    );

    const { rows: availRows } = await pool.query<{
      user_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>(`SELECT user_id, day_of_week, start_time, end_time FROM availability WHERE user_id = ANY($1)`, [userIds]);

    const interestsByUser = new Map<string, { id: string; name: string }[]>();
    for (const row of interestRows) {
      const list = interestsByUser.get(row.user_id) ?? [];
      list.push({ id: row.id, name: row.name });
      interestsByUser.set(row.user_id, list);
    }

    const availByUser = new Map<string, AvailabilityBlock[]>();
    for (const row of availRows) {
      const list = availByUser.get(row.user_id) ?? [];
      list.push({ dayOfWeek: row.day_of_week, startMinutes: timeToMinutes(row.start_time), endMinutes: timeToMinutes(row.end_time) });
      availByUser.set(row.user_id, list);
    }

    const result = new Map<string, MatchCandidate>();
    for (const profile of profileRows) {
      const interests = interestsByUser.get(profile.user_id) ?? [];
      result.set(profile.user_id, {
        userId: profile.user_id,
        personality: profile.personality ?? {},
        interestIds: interests.map((i) => i.id),
        interestNames: interests.map((i) => i.name),
        relationshipGoal: profile.relationship_goal,
        lifestyle: profile.lifestyle ?? {},
        schoolId: profile.school_id,
        majorId: profile.major_id,
        latitude: profile.latitude,
        longitude: profile.longitude,
        maxDistanceKm: profile.max_distance_km,
        availability: availByUser.get(profile.user_id) ?? [],
      });
    }
    return result;
  },
};
