import { pool } from "../../db/pool";

export interface DiscoverFilters {
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  schoolId?: string;
  majorId?: string;
  relationshipGoal?: string;
  interestIds?: string[];
  verifiedOnly?: boolean;
  limit: number;
  offset: number;
}

export interface CandidateRow {
  user_id: string;
  first_name: string;
  date_of_birth: string;
  bio: string;
  verified: boolean;
  school_id: string | null;
  major_id: string | null;
  academic_year: string | null;
  relationship_goal: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
}

export const discoveryRepository = {
  /**
   * Returns candidates who:
   * - aren't the viewer, aren't deleted/suspended/banned
   * - are discoverable
   * - haven't already been liked or passed on by the viewer
   * - satisfy mutual gender preference (if either side has one set)
   * - satisfy the requested filters
   *
   * Distance and full compatibility scoring happen in the service layer
   * (matching.algorithm), since they need data (weekly availability,
   * personality vectors) that doesn't belong in this WHERE clause.
   */
  async findCandidates(viewerId: string, filters: DiscoverFilters): Promise<CandidateRow[]> {
    const conditions: string[] = [
      `u.id <> $1`,
      `u.status = 'active'`,
      `u.deleted_at IS NULL`,
      `p.discoverable = true`,
      `NOT EXISTS (SELECT 1 FROM likes l WHERE l.liker_id = $1 AND l.liked_id = u.id)`,
      `NOT EXISTS (SELECT 1 FROM passes ps WHERE ps.user_id = $1 AND ps.passed_user_id = u.id)`,
      `NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))`,
      // Mutual gender preference: skip the check on either side if that side hasn't set one (open to all).
      `(
         cardinality(viewer.gender_preference) = 0 OR p.gender = ANY(viewer.gender_preference)
       )`,
      `(
         cardinality(p.gender_preference) = 0 OR viewer.gender = ANY(p.gender_preference)
       )`,
    ];
    const params: unknown[] = [viewerId];
    let i = 2;

    if (filters.minAge != null) {
      conditions.push(`date_part('year', age(u.date_of_birth)) >= $${i++}`);
      params.push(filters.minAge);
    }
    if (filters.maxAge != null) {
      conditions.push(`date_part('year', age(u.date_of_birth)) <= $${i++}`);
      params.push(filters.maxAge);
    }
    if (filters.schoolId) {
      conditions.push(`p.school_id = $${i++}`);
      params.push(filters.schoolId);
    }
    if (filters.majorId) {
      conditions.push(`p.major_id = $${i++}`);
      params.push(filters.majorId);
    }
    if (filters.relationshipGoal) {
      conditions.push(`p.relationship_goal = $${i++}`);
      params.push(filters.relationshipGoal);
    }
    if (filters.verifiedOnly) {
      conditions.push(`(u.email_verified_at IS NOT NULL OR u.student_verified_at IS NOT NULL)`);
    }
    if (filters.interestIds && filters.interestIds.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM user_interests ui WHERE ui.user_id = u.id AND ui.interest_id = ANY($${i++}))`,
      );
      params.push(filters.interestIds);
    }
    // Coarse bounding-box prefilter for distance (real haversine filtering happens in
    // the service layer); ~1 degree of latitude is ~111km, good enough as a prefilter.
    if (filters.maxDistanceKm != null) {
      conditions.push(`(
        viewer.latitude IS NULL OR viewer.longitude IS NULL OR p.latitude IS NULL OR p.longitude IS NULL
        OR (p.latitude BETWEEN viewer.latitude - ($${i}::float / 111.0) AND viewer.latitude + ($${i}::float / 111.0))
      )`);
      params.push(filters.maxDistanceKm);
      i++;
    }

    params.push(filters.limit, filters.offset);

    const { rows } = await pool.query<CandidateRow>(
      `SELECT
         u.id AS user_id, u.first_name, u.date_of_birth,
         p.bio, (u.email_verified_at IS NOT NULL OR u.student_verified_at IS NOT NULL) AS verified,
         p.school_id, p.major_id, p.academic_year, p.relationship_goal,
         p.latitude, p.longitude,
         (SELECT url FROM profile_photos ph WHERE ph.user_id = u.id ORDER BY ph.is_primary DESC, ph.position ASC LIMIT 1) AS photo_url
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       JOIN profiles viewer ON viewer.user_id = $1
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.last_active_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      params,
    );

    return rows;
  },
};
