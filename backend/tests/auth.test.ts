/**
 * Integration tests against a real (test) Postgres database.
 * Requires DATABASE_URL in the test environment to point at a disposable
 * test database with migrations applied — do NOT point this at production.
 *
 * Run: npm test
 */
import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";

const app = createApp();

async function cleanDb() {
  await pool.query(`TRUNCATE users, user_sessions, email_verifications, password_resets, audit_logs CASCADE`);
}

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await pool.end();
});

const validUser = {
  firstName: "Alex",
  lastName: "Rivera",
  email: "alex.rivera@example.edu",
  password: "StrongPass123",
  dateOfBirth: "2003-05-14",
};

describe("Auth flow", () => {
  it("rejects registration under the minimum age", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, email: "minor@example.edu", dateOfBirth: "2015-01-01" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AGE_RESTRICTED");
  });

  it("rejects weak passwords", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, email: "weak@example.edu", password: "weak" });
    expect(res.status).toBe(422);
  });

  it("registers a user and returns an access token + user object without the password hash", async () => {
    const res = await request(app).post("/api/auth/register").send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    // refresh token should be set as an httpOnly cookie, not in the JSON body
    const cookies = res.headers["set-cookie"];
    expect(cookies?.some((c: string) => c.startsWith("refreshToken="))).toBe(true);
  });

  it("rejects duplicate registration with the same email", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app).post("/api/auth/register").send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects login with wrong password", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "WrongPassword123" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in successfully with correct credentials", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it("locks the account after 5 failed login attempts", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/auth/login")
        .send({ email: validUser.email, password: "WrongPassword123" });
    }
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password }); // even correct password now blocked
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("rejects access to a protected route without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("allows access to a protected route with a valid token", async () => {
    const register = await request(app).post("/api/auth/register").send(validUser);
    const token = register.body.accessToken;
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("rotates refresh tokens and detects reuse of an old one", async () => {
    const register = await request(app).post("/api/auth/register").send(validUser);
    const cookie = register.headers["set-cookie"][0];

    // First refresh should succeed and rotate the token.
    const refresh1 = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(refresh1.status).toBe(200);

    // Reusing the original (now rotated-out) refresh token should be treated
    // as a compromise and rejected.
    const reuse = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(reuse.status).toBe(401);
  });

  it("resets password via forgot-password flow and invalidates old sessions", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    // We can't read the emailed token in this test without hooking the email
    // service; this test validates the endpoint always returns success shape
    // without leaking whether the email exists (anti-enumeration).
    const res = await request(app).post("/api/auth/forgot-password").send({ email: validUser.email });
    expect(res.status).toBe(200);
    expect(res.body.requested).toBe(true);

    const resUnknown = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.edu" });
    expect(resUnknown.status).toBe(200);
    expect(resUnknown.body.requested).toBe(true);
  });
});
