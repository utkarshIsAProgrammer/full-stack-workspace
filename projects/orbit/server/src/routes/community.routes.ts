import express from "express";
import {
  createCommunity,
  updateCommunity,
  getCommunities,
  getCommunity,
  getMyCommunities,
  getCommunityMembers,
  joinCommunity,
  leaveCommunity,
  deleteCommunity,
  getCommunityMessages,
  sendCommunityMessage,
  editCommunityMessage,
  deleteCommunityMessage,
  deleteCommunityMessageForMe,
  toggleCommunityMessageReaction,
  pinCommunityMessage,
  unpinCommunityMessage,
  getPinnedMessages,
} from "../controllers/community.controllers";
import { protect } from "../middlewares/auth.middleware";
import upload, { uploadChatMedia } from "../middlewares/upload.middleware";
import { generalLimiter, interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

// Apply protect middleware to all community endpoints
router.use(protect);

// Community CRUD
router.post("/", generalLimiter, upload.single("image"), createCommunity);
router.get("/", generalLimiter, getCommunities);
router.get("/mine", generalLimiter, getMyCommunities);
router.get("/:communityId", generalLimiter, getCommunity);
router.put("/:communityId", generalLimiter, upload.single("image"), updateCommunity);
router.delete("/:communityId", generalLimiter, deleteCommunity);

// Members
router.get("/:communityId/members", generalLimiter, getCommunityMembers);

// Join/leave
router.post("/:communityId/join", generalLimiter, joinCommunity);
router.post("/:communityId/leave", generalLimiter, leaveCommunity);

// Community messages
router.get("/:communityId/messages", generalLimiter, getCommunityMessages);
router.post(
  "/:communityId/messages",
  interactionLimiter,
  uploadChatMedia.array("files", 5),
  sendCommunityMessage
);

// Edit & delete messages
router.put("/messages/:messageId", interactionLimiter, editCommunityMessage);
router.delete("/messages/:messageId", interactionLimiter, deleteCommunityMessage);
router.delete("/messages/:messageId/delete-for-me", interactionLimiter, deleteCommunityMessageForMe);

// Message reactions
router.post("/messages/:messageId/reactions", interactionLimiter, toggleCommunityMessageReaction);

// Pinned messages
router.get("/:communityId/pinned-messages", generalLimiter, getPinnedMessages);
router.post("/messages/:messageId/pin", interactionLimiter, pinCommunityMessage);
router.post("/messages/:messageId/unpin", interactionLimiter, unpinCommunityMessage);

export { router as communityRoutes };
