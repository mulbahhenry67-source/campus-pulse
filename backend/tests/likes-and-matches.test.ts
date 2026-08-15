/**
 * Integration tests against a real (test) Postgres database.
 * Requires DATABASE_URL to point at a disposable test DB with migrations applied.
 */
import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";

const app = createApp();

async function cleanDb() {
  await pool.query(
    `TRUNCATE users, profiles, profile_photos, user_interests, availability,
     likes, passes, matches, blocks, notifications, audit_logs CASCADE`,
  );
}

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await pool.end();
});

async function registerAndSetupProfile(email: string, overrides: Record<string, unknown> = {}) {
  const register = await request(app)
    .post("/api/auth/register")
    .send({
      firstName: "Test",
      lastName: "User",
      email,
      password: "StrongPass123",
      dateOfBirth: "2003-01-01",
    });
  const token = register.body.accessToken as string;
  const userId = register.body.user.id as string;

  await request(app)
    .patch("/api/profiles/me")
    .set("Authorization", `Bearer ${token}`)
    .send({
      bio: "Hello",
      gender: "female",
      relationshipGoal: "serious",
      discoverable: true,
      ...overrides,
    });

  return { token, userId };
}

describe("Likes and matches", () => {
  it("does not create a match on a one-way like", async () => {
    const alice = await registerAndSetupProfile("alice@example.edu");
    const bob = await registerAndSetupProfile("bob@example.edu");

    const res = await request(app)
      .post("/api/likes")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ userId: bob.userId });

    expect(res.status).toBe(201);
    expect(res.body.matched).toBe(false);
  });

  it("creates a match when both users like each other", async () => {
    const alice = await registerAndSetupProfile("alice2@example.edu");
    const bob = await registerAndSetupProfile("bob2@example.edu");

    await request(app).post("/api/likes").set("Authorization", `Bearer ${alice.token}`).send({ userId: bob.userId });
    const res = await request(app)
      .post("/api/likes")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ userId: alice.userId });

    expect(res.status).toBe(201);
    expect(res.body.matched).toBe(true);
    expect(res.body.matchId).toBeDefined();

    const aliceMatches = await request(app).get("/api/matches").set("Authorization", `Bearer ${alice.token}`);
    expect(aliceMatches.body.items).toHaveLength(1);
    expect(aliceMatches.body.items[0].other_user_id).toBe(bob.userId);

    const bobNotifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${bob.token}`);
    expect(bobNotifications.body.items.some((n: { type: string }) => n.type === "new_match")).toBe(true);
  });

  it("rejects liking your own profile", async () => {
    const alice = await registerAndSetupProfile("alice3@example.edu");
    const res = await request(app)
      .post("/api/likes")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ userId: alice.userId });
    expect(res.status).toBe(400);
  });

  it("allows unmatching, after which the match no longer appears in either list", async () => {
    const alice = await registerAndSetupProfile("alice4@example.edu");
    const bob = await registerAndSetupProfile("bob4@example.edu");

    await request(app).post("/api/likes").set("Authorization", `Bearer ${alice.token}`).send({ userId: bob.userId });
    const matchRes = await request(app)
      .post("/api/likes")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ userId: alice.userId });
    const matchId = matchRes.body.matchId;

    const unmatch = await request(app)
      .delete(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(unmatch.status).toBe(200);

    const aliceMatches = await request(app).get("/api/matches").set("Authorization", `Bearer ${alice.token}`);
    expect(aliceMatches.body.items).toHaveLength(0);
  });

  it("excludes passed users from the discovery feed", async () => {
    const alice = await registerAndSetupProfile("alice5@example.edu", { latitude: 40.7128, longitude: -74.006 });
    const bob = await registerAndSetupProfile("bob5@example.edu", { latitude: 40.72, longitude: -74.0 });

    await request(app).post("/api/likes/pass").set("Authorization", `Bearer ${alice.token}`).send({ userId: bob.userId });

    const feed = await request(app).get("/api/discover").set("Authorization", `Bearer ${alice.token}`);
    expect(feed.status).toBe(200);
    expect(feed.body.results.find((r: { userId: string }) => r.userId === bob.userId)).toBeUndefined();
  });

  it("discovery feed returns compatibility scores with an explanatory note", async () => {
    const alice = await registerAndSetupProfile("alice6@example.edu", {
      latitude: 40.7128,
      longitude: -74.006,
      maxDistanceKm: 100,
    });
    const bob = await registerAndSetupProfile("bob6@example.edu", {
      latitude: 40.72,
      longitude: -74.0,
      gender: "male",
    });

    const feed = await request(app).get("/api/discover").set("Authorization", `Bearer ${alice.token}`);
    expect(feed.status).toBe(200);
    const entry = feed.body.results.find((r: { userId: string }) => r.userId === bob.userId);
    expect(entry).toBeDefined();
    expect(entry.compatibility.score).toBeGreaterThanOrEqual(0);
    expect(entry.compatibility.note).toMatch(/estimate/i);
  });
});
