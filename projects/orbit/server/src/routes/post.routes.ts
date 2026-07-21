import express from "express";
import {
  getPost,
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
  sharePost,
  viewsCount,
  getPostBySlug,
  getPostsByHashtag,
  pinPost,
  unpinPost,
  votePoll,
  inviteCollab,
  acceptCollab,
  publishDraft,
  quoteRepost,
  getTrendingHashtags,
} from "../controllers/post.controllers";
import {
  archivePost,
  unarchivePost,
  getArchivedPosts,
} from "../controllers/archive.controllers";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import { protectViews } from "../middlewares/view.middleware";
import { uploadPostMedia } from "../middlewares/upload.middleware";
import { searchLimiter, interactionLimiter } from "../middlewares/ratelimit.middleware";
import { cacheMiddleware } from "../middlewares/cache.middleware";
import { getDrafts, createDraft, createScheduledPost } from "../controllers/draft.controller";

const router = express.Router();

// Specific routes (must be before /:postId routes to avoid matching as postId)
router.get("/trending/hashtags", optionalAuth, cacheMiddleware({ ttl: 300 }), getTrendingHashtags);
router.get("/archived", protect, getArchivedPosts);
router.get("/hashtag/:hashtag", optionalAuth, searchLimiter, cacheMiddleware({ ttl: 300 }), getPostsByHashtag);
router.get("/slug/:slug", optionalAuth, cacheMiddleware({ ttl: 300 }), getPostBySlug);
router.get("/:postId", optionalAuth, cacheMiddleware({ ttl: 300 }), getPost);
router.get("/", optionalAuth, cacheMiddleware({ ttl: 60 }), getAllPosts);
router.post(
  "/",
  protect,
  uploadPostMedia.fields([
    { name: "images", maxCount: 10 },
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  createPost,
);
router.put(
  "/:postId",
  protect,
  uploadPostMedia.fields([
    { name: "images", maxCount: 10 },
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  updatePost,
);
router.delete("/:postId", protect, deletePost);

router.post("/:postId/view", protectViews, interactionLimiter, viewsCount);
router.post("/:postId/share", protect, interactionLimiter, sharePost);
router.post("/:postId/pin", protect, pinPost);
router.post("/:postId/unpin", protect, unpinPost);
router.post("/:postId/archive", protect, interactionLimiter, archivePost);
router.post("/:postId/unarchive", protect, interactionLimiter, unarchivePost);

// Poll voting
router.post("/:postId/vote", protect, interactionLimiter, votePoll);

// Collab invitations
router.post("/:postId/collab-invite", protect, interactionLimiter, inviteCollab);
router.post("/:postId/collab-accept", protect, interactionLimiter, acceptCollab);

// Post scheduling / draft publishing
router.post("/:postId/publish", protect, interactionLimiter, publishDraft);

// Quote repost (repost with commentary)
router.post("/:postId/quote-repost", protect, interactionLimiter, quoteRepost);

// Draft & scheduled post management
router.get("/drafts", protect, getDrafts);
router.post(
  "/drafts",
  protect,
  uploadPostMedia.fields([{ name: "images", maxCount: 10 }, { name: "image", maxCount: 1 }, { name: "video", maxCount: 1 }]),
  createDraft
);
router.post("/schedule", protect, interactionLimiter, createScheduledPost);

export { router as postRoutes };

