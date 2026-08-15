import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";

const app = createApp();

async function cleanDb() {
  await pool.query(
    `TRUNCATE users, profiles, likes, passes, matches, blocks, messages,
     message_reactions, message_reads, reports, notifications CASCADE`,
  );
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

/** Creates a mutual match between two fresh users and returns the matchId. */
async function createMatch() {
  const alice = await registerUser(`alice-${Date.now()}@example.edu`);
  const bob = await registerUser(`bob-${Date.now()}@example.edu`);
  await request(app).post("/api/likes").set("Authorization", `Bearer ${alice.token}`).send({ userId: bob.userId });
  const res = await request(app).post("/api/likes").set("Authorization", `Bearer ${bob.token}`).send({ userId: alice.userId });
  return { matchId: res.body.matchId as string, alice, bob };
}

describe("Messaging", () => {
  it("allows a matched user to send and retrieve a text message", async () => {
    const { matchId, alice, bob } = await createMatch();

    const send = await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Hey! You both like football." });
    expect(send.status).toBe(201);
    expect(send.body.message.content).toBe("Hey! You both like football.");

    const list = await request(app)
      .get(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
  });

  it("rejects a message with neither content nor an image", async () => {
    const { matchId, alice } = await createMatch();
    const res = await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it("rejects messages from a user who isn't part of the match", async () => {
    const { matchId } = await createMatch();
    const stranger = await registerUser(`stranger-${Date.now()}@example.edu`);
    const res = await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ content: "hi" });
    expect(res.status).toBe(403);
  });

  it("blocks messaging once one user has blocked the other", async () => {
    const { matchId, alice, bob } = await createMatch();
    await pool.query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [alice.userId, bob.userId]);

    const res = await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "hello?" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("BLOCKED");
  });

  it("tracks unread counts and clears them on mark-read", async () => {
    const { matchId, alice, bob } = await createMatch();
    await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "one" });
    await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "two" });

    const bobConvos = await request(app).get("/api/conversations").set("Authorization", `Bearer ${bob.token}`);
    const convo = bobConvos.body.items.find((c: { match_id: string }) => c.match_id === matchId);
    expect(convo.unread_count).toBe(2);

    await request(app).post(`/api/conversations/${matchId}/read`).set("Authorization", `Bearer ${bob.token}`);

    const bobConvosAfter = await request(app).get("/api/conversations").set("Authorization", `Bearer ${bob.token}`);
    const convoAfter = bobConvosAfter.body.items.find((c: { match_id: string }) => c.match_id === matchId);
    expect(convoAfter.unread_count).toBe(0);
  });

  it("lets the sender delete their own message but not the other participant", async () => {
    const { matchId, alice, bob } = await createMatch();
    const send = await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "oops" });
    const messageId = send.body.message.id;

    const forbidden = await request(app).delete(`/api/messages/${messageId}`).set("Authorization", `Bearer ${bob.token}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app).delete(`/api/messages/${messageId}`).set("Authorization", `Bearer ${alice.token}`);
    expect(ok.status).toBe(200);
  });

  it("supports adding and removing a reaction", async () => {
    const { matchId, alice, bob } = await createMatch();
    const send = await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "funny joke" });
    const messageId = send.body.message.id;

    const react = await request(app)
      .put(`/api/messages/${messageId}/reactions`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ emoji: "😂" });
    expect(react.status).toBe(200);

    const list = await request(app)
      .get(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(list.body.items[0].reactions).toEqual([{ emoji: "😂", userId: bob.userId }]);

    const remove = await request(app)
      .delete(`/api/messages/${messageId}/reactions`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(remove.status).toBe(200);
  });

  it("allows reporting a message", async () => {
    const { matchId, alice, bob } = await createMatch();
    const send = await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "something inappropriate" });

    const report = await request(app)
      .post(`/api/messages/${send.body.message.id}/report`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ reason: "inappropriate_content", description: "made me uncomfortable" });
    expect(report.status).toBe(201);
    expect(report.body.reportId).toBeDefined();
  });
});
