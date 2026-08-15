import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";

const app = createApp();

async function cleanDb() {
  await pool.query(`TRUNCATE users, reports, verification_requests, audit_logs, messages, matches CASCADE`);
}

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await pool.end();
});

async function registerUser(email: string, role: "user" | "moderator" | "admin" | "super_admin" = "user") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ firstName: "T", lastName: "User", email, password: "StrongPass123", dateOfBirth: "2003-01-01" });
  const userId = res.body.user.id as string;
  if (role !== "user") {
    await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userId]);
    // Role is embedded in the access token at login, so re-login to pick up the change.
    const login = await request(app).post("/api/auth/login").send({ email, password: "StrongPass123" });
    return { token: login.body.accessToken as string, userId };
  }
  return { token: res.body.accessToken as string, userId };
}

describe("Admin access control", () => {
  it("rejects a regular user from any admin route", async () => {
    const user = await registerUser(`user-${Date.now()}@example.edu`);
    const res = await request(app).get("/api/admin/overview").set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  it("allows a moderator to view the reports queue but not suspend a user", async () => {
    const mod = await registerUser(`mod-${Date.now()}@example.edu`, "moderator");
    const target = await registerUser(`target-${Date.now()}@example.edu`);

    const reports = await request(app).get("/api/admin/reports").set("Authorization", `Bearer ${mod.token}`);
    expect(reports.status).toBe(200);

    const suspend = await request(app)
      .post(`/api/admin/users/${target.userId}/suspend`)
      .set("Authorization", `Bearer ${mod.token}`)
      .send({ reason: "test" });
    expect(suspend.status).toBe(403);
  });

  it("allows an admin to suspend and restore a user", async () => {
    const admin = await registerUser(`admin-${Date.now()}@example.edu`, "admin");
    const target = await registerUser(`target2-${Date.now()}@example.edu`);

    const suspend = await request(app)
      .post(`/api/admin/users/${target.userId}/suspend`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reason: "Repeated harassment reports" });
    expect(suspend.status).toBe(200);
    expect(suspend.body.user.status).toBe("suspended");

    const restore = await request(app)
      .post(`/api/admin/users/${target.userId}/restore`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(restore.status).toBe(200);
    expect(restore.body.user.status).toBe("active");
  });

  it("revokes the target user's sessions on suspend", async () => {
    const admin = await registerUser(`admin3-${Date.now()}@example.edu`, "admin");
    const email = `target3-${Date.now()}@example.edu`;
    const target = await registerUser(email);

    await request(app)
      .post(`/api/admin/users/${target.userId}/suspend`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reason: "test" });

    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL`,
      [target.userId],
    );
    expect(Number(rows[0].count)).toBe(0);
  });
});

describe("Reports queue", () => {
  it("lets a moderator review a report and records the resolution", async () => {
    const mod = await registerUser(`mod2-${Date.now()}@example.edu`, "moderator");
    const reporter = await registerUser(`reporter-${Date.now()}@example.edu`);

    const { rows } = await pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, description) VALUES ($1, 'user', $2, 'harassment', 'test') RETURNING id`,
      [reporter.userId, reporter.userId],
    );
    const reportId = rows[0].id;

    const review = await request(app)
      .post(`/api/admin/reports/${reportId}/review`)
      .set("Authorization", `Bearer ${mod.token}`)
      .send({ status: "resolved", moderatorNotes: "Verified and actioned." });
    expect(review.status).toBe(200);
    expect(review.body.report.status).toBe("resolved");
    expect(review.body.report.resolved_by).toBe(mod.userId);
  });
});

describe("Verification review", () => {
  it("lets a user submit a verification request and blocks a second pending one", async () => {
    const user = await registerUser(`verify-${Date.now()}@example.edu`);
    const submit = await request(app)
      .post("/api/verification/request")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ method: "school_email", schoolEmail: "verify@university.edu" });
    expect(submit.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/verification/request")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ method: "school_email", schoolEmail: "verify@university.edu" });
    expect(duplicate.status).toBe(409);
  });

  it("approving a request sets student_verified_at on the user", async () => {
    const mod = await registerUser(`mod3-${Date.now()}@example.edu`, "moderator");
    const user = await registerUser(`verify2-${Date.now()}@example.edu`);

    const submit = await request(app)
      .post("/api/verification/request")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ method: "student_id", studentIdImageUrl: "https://example.com/id.jpg" });
    const requestId = submit.body.request.id;

    const approve = await request(app)
      .post(`/api/admin/verification-requests/${requestId}/approve`)
      .set("Authorization", `Bearer ${mod.token}`)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.request.status).toBe("approved");

    const { rows } = await pool.query(`SELECT student_verified_at FROM users WHERE id = $1`, [user.userId]);
    expect(rows[0].student_verified_at).not.toBeNull();
  });

  it("rejects an invalid verification submission missing required fields", async () => {
    const user = await registerUser(`verify3-${Date.now()}@example.edu`);
    const res = await request(app)
      .post("/api/verification/request")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ method: "school_email" });
    expect(res.status).toBe(422);
  });
});

describe("Admin overview stats", () => {
  it("returns sane counts reflecting seeded data", async () => {
    const admin = await registerUser(`admin2-${Date.now()}@example.edu`, "admin");
    await registerUser(`extra-${Date.now()}@example.edu`);

    const res = await request(app).get("/api/admin/overview").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(2);
    expect(typeof res.body.pendingReports).toBe("number");
  });
});
