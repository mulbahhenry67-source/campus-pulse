import { pool } from "../../db/pool";

export const profileRepository = {
  async get(userId: string) {
    const { rows } = await pool.query(
      `SELECT p.*, u.first_name, u.last_name, u.date_of_birth, (u.email_verified_at IS NOT NULL OR u.student_verified_at IS NOT NULL) AS verified
       FROM profiles p JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  },

  /** Creates an empty profile row on first touch (called at registration or first onboarding step). */
  async ensureExists(userId: string) {
    await pool.query(`INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  },

  async update(userId: string, fields: Record<string, unknown>) {
    const columnMap: Record<string, string> = {
      bio: "bio",
      gender: "gender",
      genderPreference: "gender_preference",
      schoolId: "school_id",
      majorId: "major_id",
      academicYear: "academic_year",
      relationshipGoal: "relationship_goal",
      personality: "personality",
      lifestyle: "lifestyle",
      latitude: "latitude",
      longitude: "longitude",
      minAgePreference: "min_age_preference",
      maxAgePreference: "max_age_preference",
      maxDistanceKm: "max_distance_km",
      discoverable: "discoverable",
      showDistance: "show_distance",
    };

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(fields)) {
      const column = columnMap[key];
      if (!column) continue;
      const isJson = column === "personality" || column === "lifestyle";
      sets.push(`${column} = $${i++}`);
      values.push(isJson ? JSON.stringify(value) : value);
    }
    if (sets.length === 0) return;

    values.push(userId);
    await pool.query(`UPDATE profiles SET ${sets.join(", ")} WHERE user_id = $${i}`, values);
  },

  async markOnboardingComplete(userId: string) {
    await pool.query(`UPDATE profiles SET onboarding_completed_at = now() WHERE user_id = $1`, [userId]);
  },

  async touchLastActive(userId: string) {
    await pool.query(`UPDATE profiles SET last_active_at = now() WHERE user_id = $1`, [userId]);
  },

  async setInterests(userId: string, interestIds: string[]) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM user_interests WHERE user_id = $1`, [userId]);
      for (const interestId of interestIds) {
        await client.query(
          `INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, interestId],
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

  async getInterests(userId: string) {
    const { rows } = await pool.query(
      `SELECT i.id, i.name, i.category FROM user_interests ui JOIN interests i ON i.id = ui.interest_id WHERE ui.user_id = $1`,
      [userId],
    );
    return rows;
  },

  async getPhotos(userId: string) {
    const { rows } = await pool.query(
      `SELECT id, url, position, is_primary AS "isPrimary" FROM profile_photos WHERE user_id = $1 ORDER BY position`,
      [userId],
    );
    return rows;
  },

  async addPhoto(userId: string, url: string, isPrimary: boolean) {
    const { rows: countRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM profile_photos WHERE user_id = $1`,
      [userId],
    );
    const position = Number(countRows[0].count);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (isPrimary) {
        await client.query(`UPDATE profile_photos SET is_primary = false WHERE user_id = $1`, [userId]);
      }
      const { rows } = await client.query(
        `INSERT INTO profile_photos (user_id, url, position, is_primary) VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, url, position, isPrimary || position === 0],
      );
      await client.query("COMMIT");
      return rows[0].id as string;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async removePhoto(userId: string, photoId: string) {
    await pool.query(`DELETE FROM profile_photos WHERE id = $1 AND user_id = $2`, [photoId, userId]);
  },

  async listSchools() {
    const { rows } = await pool.query(`SELECT id, name FROM schools ORDER BY name`);
    return rows;
  },

  async listMajors() {
    const { rows } = await pool.query(`SELECT id, name FROM majors ORDER BY name`);
    return rows;
  },

  async listInterestOptions() {
    const { rows } = await pool.query(`SELECT id, name, category FROM interests ORDER BY category, name`);
    return rows;
  },
};
