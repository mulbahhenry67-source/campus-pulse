import { Router } from "express";
import { communitiesService, createPostSchema, addCommentSchema, reportSchema } from "./communities.service";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";

export const communitiesRouter = Router();
export const communityPostsRouter = Router();

communitiesRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const items = await communitiesService.list(req.user!.id, search, category);
    res.json({ items });
  }),
);

communitiesRouter.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const community = await communitiesService.get(req.params.id, req.user!.id);
    res.json({ community });
  }),
);

communitiesRouter.post(
  "/:id/join",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await communitiesService.join(req.params.id, req.user!.id);
    res.json(result);
  }),
);

communitiesRouter.post(
  "/:id/leave",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await communitiesService.leave(req.params.id, req.user!.id);
    res.json(result);
  }),
);

communitiesRouter.get(
  "/:id/posts",
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const items = await communitiesService.listPosts(req.params.id, req.user!.id, limit, offset);
    res.json({ items });
  }),
);

communitiesRouter.post(
  "/:id/posts",
  authenticate,
  validateBody(createPostSchema),
  asyncHandler(async (req, res) => {
    const post = await communitiesService.createPost(req.params.id, req.user!.id, req.body.content);
    res.status(201).json({ post });
  }),
);

communitiesRouter.post(
  "/:id/report",
  authenticate,
  validateBody(reportSchema),
  asyncHandler(async (req, res) => {
    const result = await communitiesService.reportCommunity(req.user!.id, req.params.id, req.body.reason, req.body.description);
    res.status(201).json(result);
  }),
);

// ---- Post-level actions (mounted at /api/community-posts) ----
communityPostsRouter.delete(
  "/:postId",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await communitiesService.deletePost(req.params.postId, req.user!.id);
    res.json(result);
  }),
);

communityPostsRouter.post(
  "/:postId/like",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await communitiesService.toggleLike(req.params.postId, req.user!.id);
    res.json(result);
  }),
);

communityPostsRouter.get(
  "/:postId/comments",
  authenticate,
  asyncHandler(async (req, res) => {
    const items = await communitiesService.listComments(req.params.postId);
    res.json({ items });
  }),
);

communityPostsRouter.post(
  "/:postId/comments",
  authenticate,
  validateBody(addCommentSchema),
  asyncHandler(async (req, res) => {
    const comment = await communitiesService.addComment(req.params.postId, req.user!.id, req.body.content);
    res.status(201).json({ comment });
  }),
);

communityPostsRouter.post(
  "/:postId/report",
  authenticate,
  validateBody(reportSchema),
  asyncHandler(async (req, res) => {
    const result = await communitiesService.reportPost(req.user!.id, req.params.postId, req.body.reason, req.body.description);
    res.status(201).json(result);
  }),
);
