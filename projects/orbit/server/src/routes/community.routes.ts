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
  searchCommunityMessages,
  sendCommunityMessage,
  editCommunityMessage,
  deleteCommunityMessage,
  deleteCommunityMessageForMe,
  toggleCommunityMessageReaction,
  pinCommunityMessage,
  unpinCommunityMessage,
  getPinnedMessages,
  removeMemberFromCommunity,
  toggleCommunityMessaging,
  toggleCommunityAudioCalls,
  toggleCommunityVideoCalls,
  clearCommunityChat,
  generateLiveKitToken,
  getCommunityMedia,
  muteCommunityNotifications,
  unmuteCommunityNotifications,
  getCommunityMutedStatus,
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
router.get("/:communityId/messages/search", generalLimiter, searchCommunityMessages);
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

// Admin / Creator actions
router.post("/:communityId/remove-member", generalLimiter, removeMemberFromCommunity);
router.post("/:communityId/toggle-messaging", generalLimiter, toggleCommunityMessaging);
router.post("/:communityId/toggle-audio-calls", generalLimiter, toggleCommunityAudioCalls);
router.post("/:communityId/toggle-video-calls", generalLimiter, toggleCommunityVideoCalls);
router.post("/:communityId/clear-chat", generalLimiter, clearCommunityChat);

// Community media by type (images, videos, voice notes, files)
router.get("/:communityId/media", generalLimiter, getCommunityMedia);

// LiveKit group call token
router.post("/:communityId/livekit-token", generalLimiter, generateLiveKitToken);

// Per-user notification mute settings (any member)
router.get("/:communityId/muted", generalLimiter, getCommunityMutedStatus);
router.post("/:communityId/mute", generalLimiter, muteCommunityNotifications);
router.post("/:communityId/unmute", generalLimiter, unmuteCommunityNotifications);

export { router as communityRoutes };
