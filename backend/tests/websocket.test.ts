import { WebSocket } from "ws";
import { AddressInfo } from "net";
import request from "supertest";
import { createApp } from "../src/app";
import { attachWebSocketServer } from "../src/ws/socket.server";
import { pool } from "../src/db/pool";

const app = createApp();
const server = app.listen(0);
attachWebSocketServer(server);

async function cleanDb() {
  await pool.query(`TRUNCATE users, profiles, likes, matches, messages, notifications CASCADE`);
}

function wsUrl(token: string) {
  const { port } = server.address() as AddressInfo;
  return `ws://127.0.0.1:${port}/ws?token=${token}`;
}

function waitForMessage(socket: WebSocket, predicate: (msg: Record<string, unknown>) => boolean, timeoutMs = 3000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for WebSocket message")), timeoutMs);
    socket.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (predicate(msg)) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });
}

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ firstName: "T", lastName: "User", email, password: "StrongPass123", dateOfBirth: "2003-01-01" });
  return { token: res.body.accessToken as string, userId: res.body.user.id as string };
}

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await pool.end();
  server.close();
});

describe("WebSocket live messaging", () => {
  it("rejects a connection without a valid token", (done) => {
    const socket = new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`);
    socket.on("close", (code) => {
      expect(code).toBe(4401);
      done();
    });
  });

  it("pushes a live event to the recipient when a match sends a message", async () => {
    const alice = await registerUser(`alice-ws-${Date.now()}@example.edu`);
    const bob = await registerUser(`bob-ws-${Date.now()}@example.edu`);

    await request(app).post("/api/likes").set("Authorization", `Bearer ${alice.token}`).send({ userId: bob.userId });
    const matchRes = await request(app)
      .post("/api/likes")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ userId: alice.userId });
    const matchId = matchRes.body.matchId;

    const bobSocket = new WebSocket(wsUrl(bob.token));
    await new Promise((resolve) => bobSocket.on("open", resolve));

    const pushPromise = waitForMessage(bobSocket, (m) => m.type === "message:new");

    await request(app)
      .post(`/api/conversations/${matchId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "live push test" });

    const pushed = await pushPromise;
    expect(pushed.matchId).toBe(matchId);
    expect((pushed.message as { content: string }).content).toBe("live push test");

    bobSocket.close();
  });

  it("broadcasts typing indicators only to the matched partner, scoped to the right match", async () => {
    const alice = await registerUser(`alice-typing-${Date.now()}@example.edu`);
    const bob = await registerUser(`bob-typing-${Date.now()}@example.edu`);

    await request(app).post("/api/likes").set("Authorization", `Bearer ${alice.token}`).send({ userId: bob.userId });
    const matchRes = await request(app)
      .post("/api/likes")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ userId: alice.userId });
    const matchId = matchRes.body.matchId;

    const aliceSocket = new WebSocket(wsUrl(alice.token));
    const bobSocket = new WebSocket(wsUrl(bob.token));
    await Promise.all([
      new Promise((resolve) => aliceSocket.on("open", resolve)),
      new Promise((resolve) => bobSocket.on("open", resolve)),
    ]);

    const typingPromise = waitForMessage(bobSocket, (m) => m.type === "typing");
    aliceSocket.send(JSON.stringify({ type: "typing", matchId }));

    const typingEvent = await typingPromise;
    expect(typingEvent.userId).toBe(alice.userId);
    expect(typingEvent.matchId).toBe(matchId);

    aliceSocket.close();
    bobSocket.close();
  });

  it("notifies matched partners of online presence on connect", async () => {
    const alice = await registerUser(`alice-presence-${Date.now()}@example.edu`);
    const bob = await registerUser(`bob-presence-${Date.now()}@example.edu`);

    await request(app).post("/api/likes").set("Authorization", `Bearer ${alice.token}`).send({ userId: bob.userId });
    await request(app).post("/api/likes").set("Authorization", `Bearer ${bob.token}`).send({ userId: alice.userId });

    const aliceSocket = new WebSocket(wsUrl(alice.token));
    await new Promise((resolve) => aliceSocket.on("open", resolve));

    const presencePromise = waitForMessage(aliceSocket, (m) => m.type === "presence" && m.userId === bob.userId);
    const bobSocket = new WebSocket(wsUrl(bob.token));
    await new Promise((resolve) => bobSocket.on("open", resolve));

    const presence = await presencePromise;
    expect(presence.status).toBe("online");

    aliceSocket.close();
    bobSocket.close();
  });
});
