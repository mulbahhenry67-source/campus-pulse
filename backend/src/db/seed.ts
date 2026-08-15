/**
 * Seeds realistic demo data for local development: a handful of users with
 * completed profiles, a mutual match with an exchanged conversation, a
 * pending one-way like, and a community post — enough to see every core
 * flow working without manually clicking through onboarding four times.
 *
 * Demo users are clearly marked (@demo.campuspulse.local emails) so they're
 * trivially distinguishable from real accounts, and this script refuses to
 * run against a production environment.
 *
 * Run: npm run seed
 */
import "dotenv/config";
import { pool } from "./pool";
import { hashPassword } from "../utils/password";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const DEMO_PASSWORD = "DemoPass123";

if (env.NODE_ENV === "production") {
  logger.error("Refusing to seed demo data into a production environment.");
  process.exit(1);
}

interface DemoUser {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bio: string;
  relationshipGoal: string;
  personality: Record<string, number>;
  lifestyle: Record<string, string>;
  interests: string[];
  latitude: number;
  longitude: number;
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "maya@demo.campuspulse.local",
    firstName: "Maya",
    lastName: "Chen",
    dateOfBirth: "2004-03-12",
    gender: "female",
    bio: "Junior studying CS. Always down for late-night ramen and bad karaoke.",
    relationshipGoal: "serious",
    personality: { openness: 80, conscientiousness: 65, extraversion: 60, agreeableness: 75, neuroticism: 35 },
    lifestyle: { smoking: "never", drinking: "socially", exercise: "often", sleep_schedule: "night_owl" },
    interests: ["Coding", "Gaming", "Music"],
    latitude: 40.7128,
    longitude: -74.006,
    availability: [
      { dayOfWeek: 5, startTime: "16:00", endTime: "20:00" },
      { dayOfWeek: 6, startTime: "10:00", endTime: "14:00" },
    ],
  },
  {
    email: "jordan@demo.campuspulse.local",
    firstName: "Jordan",
    lastName: "Reyes",
    dateOfBirth: "2003-11-02",
    gender: "male",
    bio: "Studio art major. You'll usually find me with a camera or at the gym.",
    relationshipGoal: "serious",
    personality: { openness: 85, conscientiousness: 55, extraversion: 65, agreeableness: 70, neuroticism: 40 },
    lifestyle: { smoking: "never", drinking: "socially", exercise: "often", sleep_schedule: "night_owl" },
    interests: ["Photography", "Music", "Fitness"],
    latitude: 40.72,
    longitude: -74.0,
    availability: [
      { dayOfWeek: 5, startTime: "17:00", endTime: "21:00" },
      { dayOfWeek: 0, startTime: "11:00", endTime: "15:00" },
    ],
  },
  {
    email: "priya@demo.campuspulse.local",
    firstName: "Priya",
    lastName: "Patel",
    dateOfBirth: "2004-07-20",
    gender: "female",
    bio: "Business major, part-time barista. Ask me about my thrift store finds.",
    relationshipGoal: "casual",
    personality: { openness: 70, conscientiousness: 80, extraversion: 50, agreeableness: 65, neuroticism: 45 },
    lifestyle: { smoking: "never", drinking: "never", exercise: "sometimes", sleep_schedule: "early_bird" },
    interests: ["Fashion", "Business", "Photography"],
    latitude: 40.715,
    longitude: -74.01,
    availability: [{ dayOfWeek: 6, startTime: "09:00", endTime: "13:00" }],
  },
  {
    email: "sam@demo.campuspulse.local",
    firstName: "Sam",
    lastName: "Okafor",
    dateOfBirth: "2003-01-30",
    gender: "male",
    bio: "Mechanical engineering senior. Board games enthusiast and amateur chef.",
    relationshipGoal: "friendship",
    personality: { openness: 60, conscientiousness: 75, extraversion: 40, agreeableness: 80, neuroticism: 30 },
    lifestyle: { smoking: "never", drinking: "socially", exercise: "sometimes", sleep_schedule: "flexible" },
    interests: ["Engineering", "Gaming", "Coding"],
    latitude: 40.73,
    longitude: -73.99,
    availability: [{ dayOfWeek: 3, startTime: "18:00", endTime: "22:00" }],
  },
];

async function upsertUser(u: DemoUser): Promise<string> {
  const existing = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [u.email]);
  if (existing.rows[0]) return existing.rows[0].id;

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
    [u.email, passwordHash, u.firstName, u.lastName, u.dateOfBirth],
  );
  const userId = rows[0].id;

  await pool.query(
    `INSERT INTO profiles (user_id, bio, gender, relationship_goal, personality, lifestyle, latitude, longitude, discoverable, onboarding_completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now())`,
    [userId, u.bio, u.gender, u.relationshipGoal, JSON.stringify(u.personality), JSON.stringify(u.lifestyle), u.latitude, u.longitude],
  );

  await pool.query(`INSERT INTO profile_photos (user_id, url, position, is_primary) VALUES ($1, $2, 0, true)`, [
    userId,
    `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(u.firstName)}`,
  ]);

  for (const name of u.interests) {
    await pool.query(
      `INSERT INTO user_interests (user_id, interest_id)
       SELECT $1, id FROM interests WHERE name = $2
       ON CONFLICT DO NOTHING`,
      [userId, name],
    );
  }

  for (const block of u.availability) {
    await pool.query(
      `INSERT INTO availability (user_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)`,
      [userId, block.dayOfWeek, block.startTime, block.endTime],
    );
  }

  return userId;
}

async function seed() {
  logger.info("Seeding demo data...");

  const ids: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    ids[u.firstName] = await upsertUser(u);
    logger.info(`Upserted demo user: ${u.firstName} (${u.email})`);
  }

  // Mutual match + conversation: Maya <-> Jordan
  await pool.query(
    `INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [ids.Maya, ids.Jordan],
  );
  await pool.query(
    `INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [ids.Jordan, ids.Maya],
  );
  const [low, high] = [ids.Maya, ids.Jordan].sort();
  const matchResult = await pool.query<{ id: string }>(
    `INSERT INTO matches (user_low_id, user_high_id) VALUES ($1, $2)
     ON CONFLICT (user_low_id, user_high_id) DO UPDATE SET matched_at = matches.matched_at
     RETURNING id`,
    [low, high],
  );
  const matchId = matchResult.rows[0].id;

  const { rows: existingMessages } = await pool.query(`SELECT 1 FROM messages WHERE match_id = $1 LIMIT 1`, [matchId]);
  if (existingMessages.length === 0) {
    await pool.query(`INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3)`, [
      matchId,
      ids.Maya,
      "Hey! I saw we're both into photography and coding — rare combo 😄",
    ]);
    await pool.query(`UPDATE matches SET last_message_at = now() WHERE id = $1`, [matchId]);
    await pool.query(`INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3)`, [
      matchId,
      ids.Jordan,
      "Ha, right? What are you working on lately?",
    ]);
    await pool.query(`UPDATE matches SET last_message_at = now() WHERE id = $1`, [matchId]);
  }

  // One-way like, no match yet: Sam -> Priya
  await pool.query(`INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [ids.Sam, ids.Priya]);

  // A community post from Maya in Coding
  const { rows: community } = await pool.query<{ id: string }>(`SELECT id FROM communities WHERE slug = 'coding'`);
  if (community[0]) {
    await pool.query(
      `INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [community[0].id, ids.Maya],
    );
    const { rows: existingPost } = await pool.query(
      `SELECT 1 FROM community_posts WHERE community_id = $1 AND author_id = $2 LIMIT 1`,
      [community[0].id, ids.Maya],
    );
    if (existingPost.length === 0) {
      await pool.query(
        `INSERT INTO community_posts (community_id, author_id, content) VALUES ($1, $2, $3)`,
        [community[0].id, ids.Maya, "Anyone else's group project repo a disaster right now? Send help 😅"],
      );
    }
  }

  logger.info("Demo data seeded successfully.");
  logger.info(`All demo accounts share the password: ${DEMO_PASSWORD}`);
  logger.info("Demo emails: " + DEMO_USERS.map((u) => u.email).join(", "));
  await pool.end();
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
