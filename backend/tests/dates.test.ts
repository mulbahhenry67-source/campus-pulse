import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";

const app = createApp();

async function cleanDb() {
  await pool.query(`TRUNCATE users, likes, matches, date_plans, notifications CASCADE`);
}

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await pool.end();
});

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ firstName: "T", lastName: "User", email, password: "StrongPass123", dateOfBirth: "2003-01-01" });
  return { token: res.body.accessToken as string, userId: res.body.user.id as string };
}

async function createMatch() {
  const alice = await registerUser(`alice-dp-${Date.now()}@example.edu`);
  const bob = await registerUser(`bob-dp-${Date.now()}@example.edu`);
  await request(app).post("/api/likes").set("Authorization", `Bearer ${alice.token}`).send({ userId: bob.userId });
  const res = await request(app).post("/api/likes").set("Authorization", `Bearer ${bob.token}`).send({ userId: alice.userId });
  return { matchId: res.body.matchId as string, alice, bob };
}

describe("Date planner", () => {
  it("lets a matched user propose a date", async () => {
    const { matchId, alice } = await createMatch();
    const res = await request(app)
      .post(`/api/matches/${matchId}/date-plans`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ activity: "coffee", proposedDate: "2026-09-01", proposedTime: "15:00", locationNote: "The campus center coffee shop" });
    expect(res.status).toBe(201);
    expect(res.body.plan.status).toBe("proposed");
    expect(res.body.plan.confirmed_by_proposer).toBe(true);
    expect(res.body.plan.confirmed_by_recipient).toBe(false);
  });

  it("requires a custom activity label when activity is 'other'", async () => {
    const { matchId, alice } = await createMatch();
    const res = await request(app)
      .post(`/api/matches/${matchId}/date-plans`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ activity: "other", proposedDate: "2026-09-01", proposedTime: "15:00" });
    expect(res.status).toBe(422);
  });

  it("rejects proposals from someone outside the match", async () => {
    const { matchId } = await createMatch();
    const stranger = await registerUser(`stranger-dp-${Date.now()}@example.edu`);
    const res = await request(app)
      .post(`/api/matches/${matchId}/date-plans`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ activity: "coffee", proposedDate: "2026-09-01", proposedTime: "15:00" });
    expect(res.status).toBe(403);
  });

  it("confirms a plan and notifies the proposer, and prevents self-confirmation", async () => {
    const { matchId, alice, bob } = await createMatch();
    const propose = await request(app)
      .post(`/api/matches/${matchId}/date-plans`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ activity: "walk", proposedDate: "2026-09-02", proposedTime: "10:00", locationNote: "Main quad" });
    const planId = propose.body.plan.id;

    const selfConfirm = await request(app).post(`/api/date-plans/${planId}/confirm`).set("Authorization", `Bearer ${alice.token}`);
    expect(selfConfirm.status).toBe(400);

    const confirm = await request(app).post(`/api/date-plans/${planId}/confirm`).set("Authorization", `Bearer ${bob.token}`);
    expect(confirm.status).toBe(200);
    expect(confirm.body.plan.status).toBe("confirmed");

    const aliceNotifications = await request(app).get("/api/notifications").set("Authorization", `Bearer ${alice.token}`);
    expect(aliceNotifications.body.items.some((n: { type: string }) => n.type === "date_confirmation")).toBe(true);
  });

  it("allows declining a proposed date", async () => {
    const { matchId, alice, bob } = await createMatch();
    const propose = await request(app)
      .post(`/api/matches/${matchId}/date-plans`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ activity: "movie", proposedDate: "2026-09-03", proposedTime: "19:00" });

    const decline = await request(app)
      .post(`/api/date-plans/${propose.body.plan.id}/decline`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(decline.status).toBe(200);
    expect(decline.body.plan.status).toBe("declined");
  });

  it("lists all proposed date plans for a match", async () => {
    const { matchId, alice } = await createMatch();
    await request(app)
      .post(`/api/matches/${matchId}/date-plans`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ activity: "study_session", proposedDate: "2026-09-04", proposedTime: "14:00" });

    const list = await request(app).get(`/api/matches/${matchId}/date-plans`).set("Authorization", `Bearer ${alice.token}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
  });
});
