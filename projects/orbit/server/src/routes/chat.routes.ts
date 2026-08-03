import express from "express";
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  deleteMessageForMe,
  getUserPresence,
  deleteConversation,
  clearConversationMessages,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
} from "../controllers/chat.controllers";
import { toggleReaction } from "../controllers/reaction.controllers";
import { searchMessages } from "../controllers/messageSearch.controllers";
import { protect } from "../middlewares/auth.middleware";
import { uploadChatMedia } from "../middlewares/upload.middleware";
import { generalLimiter, interactionLimiter } from "../middlewares/ratelimit.middleware";
import { cacheMiddleware } from "../middlewares/cache.middleware";

const router = express.Router();

// Apply protect middleware to all chat endpoints
router.use(protect);

// Conversations routes
router.post("/conversations", generalLimiter, getOrCreateConversation);
router.get("/conversations", generalLimiter, cacheMiddleware({ ttl: 30 }), getConversations);
router.delete("/conversations/:conversationId", generalLimiter, deleteConversation);
router.delete("/conversations/:conversationId/messages", generalLimiter, clearConversationMessages);

// Messages routes
router.get("/conversations/:conversationId/messages", generalLimiter, cacheMiddleware({ ttl: 10 }), getMessages);
router.post(
  "/conversations/:conversationId/messages",
  interactionLimiter,
  uploadChatMedia.array("files", 5),
  sendMessage
);

// Edit & delete routes
router.put("/messages/:messageId", interactionLimiter, editMessage);
router.delete("/messages/:messageId", interactionLimiter, deleteMessage);
router.delete("/messages/:messageId/delete-for-me", interactionLimiter, deleteMessageForMe);

// Reaction route
router.post("/messages/:messageId/reactions", interactionLimiter, toggleReaction);

// Message search route
router.get("/conversations/:conversationId/search", generalLimiter, searchMessages);

// Pin / Unpin routes
router.post("/messages/:messageId/pin", interactionLimiter, pinMessage);
router.post("/messages/:messageId/unpin", interactionLimiter, unpinMessage);
router.get("/conversations/:conversationId/pinned-messages", generalLimiter, getPinnedMessages);

// Presence route
router.get("/users/:userId/presence", generalLimiter, cacheMiddleware({ ttl: 60 }), getUserPresence);

export { router as chatRoutes };
