import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";

const app = createApp();

async function cleanDb() {
  await pool.query(
    `TRUNCATE users, community_members, community_posts, community_post_likes,
     community_post_comments, reports CASCADE`,
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

async function getFootballCommunityId() {
  const { rows } = await pool.query(`SELECT id FROM communities WHERE slug = 'football'`);
  return rows[0].id as string;
}

describe("Communities", () => {
  it("lists seeded starter communities", async () => {
    const alice = await registerUser(`alice-${Date.now()}@example.edu`);
    const res = await request(app).get("/api/communities").set("Authorization", `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(10);
    expect(res.body.items.some((c: { name: string }) => c.name === "Football")).toBe(true);
  });

  it("requires membership to post", async () => {
    const alice = await registerUser(`alice2-${Date.now()}@example.edu`);
    const communityId = await getFootballCommunityId();
    const res = await request(app)
      .post(`/api/communities/${communityId}/posts`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Who's excited for Saturday's game?" });
    expect(res.status).toBe(403);
  });

  it("allows joining, posting, liking, and commenting", async () => {
    const alice = await registerUser(`alice3-${Date.now()}@example.edu`);
    const bob = await registerUser(`bob3-${Date.now()}@example.edu`);
    const communityId = await getFootballCommunityId();

    await request(app).post(`/api/communities/${communityId}/join`).set("Authorization", `Bearer ${alice.token}`);

    const post = await request(app)
      .post(`/api/communities/${communityId}/posts`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Who's excited for Saturday's game?" });
    expect(post.status).toBe(201);
    const postId = post.body.post.id;

    // Bob isn't a member, so he can't comment...
    const forbiddenComment = await request(app)
      .post(`/api/community-posts/${postId}/comments`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "Me!" });
    expect(forbiddenComment.status).toBe(403);

    // ...but liking a post doesn't require membership.
    const like = await request(app).post(`/api/community-posts/${postId}/like`).set("Authorization", `Bearer ${bob.token}`);
    expect(like.status).toBe(200);
    expect(like.body.liked).toBe(true);

    await request(app).post(`/api/communities/${communityId}/join`).set("Authorization", `Bearer ${bob.token}`);
    const comment = await request(app)
      .post(`/api/community-posts/${postId}/comments`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "Me!" });
    expect(comment.status).toBe(201);

    const posts = await request(app).get(`/api/communities/${communityId}/posts`).set("Authorization", `Bearer ${alice.token}`);
    const found = posts.body.items.find((p: { id: string }) => p.id === postId);
    expect(found.like_count).toBe(1);
    expect(found.comment_count).toBe(1);
  });

  it("updates member_count correctly on join and leave", async () => {
    const alice = await registerUser(`alice4-${Date.now()}@example.edu`);
    const communityId = await getFootballCommunityId();

    await request(app).post(`/api/communities/${communityId}/join`).set("Authorization", `Bearer ${alice.token}`);
    const afterJoin = await request(app).get(`/api/communities/${communityId}`).set("Authorization", `Bearer ${alice.token}`);
    expect(afterJoin.body.community.member_count).toBe(1);
    expect(afterJoin.body.community.joined).toBe(true);

    await request(app).post(`/api/communities/${communityId}/leave`).set("Authorization", `Bearer ${alice.token}`);
    const afterLeave = await request(app).get(`/api/communities/${communityId}`).set("Authorization", `Bearer ${alice.token}`);
    expect(afterLeave.body.community.member_count).toBe(0);
    expect(afterLeave.body.community.joined).toBe(false);
  });

  it("only lets the author delete their own post", async () => {
    const alice = await registerUser(`alice5-${Date.now()}@example.edu`);
    const bob = await registerUser(`bob5-${Date.now()}@example.edu`);
    const communityId = await getFootballCommunityId();
    await request(app).post(`/api/communities/${communityId}/join`).set("Authorization", `Bearer ${alice.token}`);

    const post = await request(app)
      .post(`/api/communities/${communityId}/posts`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "test post" });

    const forbidden = await request(app)
      .delete(`/api/community-posts/${post.body.post.id}`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/community-posts/${post.body.post.id}`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(ok.status).toBe(200);
  });
});
