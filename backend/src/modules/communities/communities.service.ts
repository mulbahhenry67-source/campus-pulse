import { z } from "zod";
import { communitiesRepository } from "./communities.repository";
import { reportsRepository, ReportReason } from "../reports/reports.repository";
import { AppError } from "../../middleware/errorHandler";

export const createPostSchema = z.object({ content: z.string().trim().min(1).max(2000) });
export const addCommentSchema = z.object({ content: z.string().trim().min(1).max(1000) });
export const reportSchema = z.object({
  reason: z.enum(["harassment", "spam", "fake_profile", "scam", "inappropriate_content", "impersonation", "other"]),
  description: z.string().max(1000).optional(),
});

async function assertMember(communityId: string, userId: string) {
  const isMember = await communitiesRepository.isMember(communityId, userId);
  if (!isMember) throw new AppError(403, "NOT_A_MEMBER", "Join this community to post here.");
}

export const communitiesService = {
  list: (userId: string, search?: string, category?: string) => communitiesRepository.list(userId, search, category),

  async get(id: string, userId: string) {
    const community = await communitiesRepository.findById(id);
    if (!community) throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found.");
    const joined = await communitiesRepository.isMember(id, userId);
    return { ...community, joined };
  },

  async join(id: string, userId: string) {
    const community = await communitiesRepository.findById(id);
    if (!community) throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found.");
    await communitiesRepository.join(id, userId);
    return { joined: true };
  },

  async leave(id: string, userId: string) {
    await communitiesRepository.leave(id, userId);
    return { joined: false };
  },

  listPosts: (communityId: string, userId: string, limit: number, offset: number) =>
    communitiesRepository.listPosts(communityId, userId, limit, offset),

  async createPost(communityId: string, userId: string, content: string) {
    await assertMember(communityId, userId);
    return communitiesRepository.createPost(communityId, userId, content);
  },

  async deletePost(postId: string, userId: string) {
    const post = await communitiesRepository.findPostById(postId);
    if (!post || post.deleted_at) throw new AppError(404, "POST_NOT_FOUND", "Post not found.");
    if (post.author_id !== userId) throw new AppError(403, "FORBIDDEN", "You can only delete your own posts.");
    await communitiesRepository.deletePost(postId);
    return { deleted: true };
  },

  async toggleLike(postId: string, userId: string) {
    const post = await communitiesRepository.findPostById(postId);
    if (!post || post.deleted_at) throw new AppError(404, "POST_NOT_FOUND", "Post not found.");
    const liked = await communitiesRepository.toggleLike(postId, userId);
    return { liked };
  },

  listComments: (postId: string) => communitiesRepository.listComments(postId),

  async addComment(postId: string, userId: string, content: string) {
    const post = await communitiesRepository.findPostById(postId);
    if (!post || post.deleted_at) throw new AppError(404, "POST_NOT_FOUND", "Post not found.");
    await assertMember(post.community_id, userId);
    return communitiesRepository.addComment(postId, userId, content);
  },

  async reportPost(reporterId: string, postId: string, reason: string, description?: string) {
    const post = await communitiesRepository.findPostById(postId);
    if (!post) throw new AppError(404, "POST_NOT_FOUND", "Post not found.");
    const reportId = await reportsRepository.create({
      reporterId,
      targetType: "community_post",
      targetId: postId,
      reason: reason as ReportReason,
      description,
    });
    return { reportId };
  },

  async reportCommunity(reporterId: string, communityId: string, reason: string, description?: string) {
    const community = await communitiesRepository.findById(communityId);
    if (!community) throw new AppError(404, "COMMUNITY_NOT_FOUND", "Community not found.");
    const reportId = await reportsRepository.create({
      reporterId,
      targetType: "community",
      targetId: communityId,
      reason: reason as ReportReason,
      description,
    });
    return { reportId };
  },
};
