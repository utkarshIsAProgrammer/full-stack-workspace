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
} from "../controllers/chat.controllers";
import { toggleReaction } from "../controllers/reaction.controllers";
import { protect } from "../middlewares/auth.middleware";
import { uploadChatMedia } from "../middlewares/upload.middleware";
import { generalLimiter, interactionLimiter } from "../middlewares/ratelimit.middleware";
import { cacheMiddleware } from "../middleware/cache.middleware";

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

// Presence route
router.get("/users/:userId/presence", generalLimiter, cacheMiddleware({ ttl: 60 }), getUserPresence);

export { router as chatRoutes };
