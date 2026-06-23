"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = void 0;
const express_1 = __importDefault(require("express"));
const chat_controllers_1 = require("../controllers/chat.controllers");
const reaction_controllers_1 = require("../controllers/reaction.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = express_1.default.Router();
exports.chatRoutes = router;
// Apply protect middleware to all chat endpoints
router.use(auth_middleware_1.protect);
// Conversations routes
router.post("/conversations", ratelimit_middleware_1.generalLimiter, chat_controllers_1.getOrCreateConversation);
router.get("/conversations", ratelimit_middleware_1.generalLimiter, (0, cache_middleware_1.cacheMiddleware)({ ttl: 30 }), chat_controllers_1.getConversations);
router.delete("/conversations/:conversationId", ratelimit_middleware_1.generalLimiter, chat_controllers_1.deleteConversation);
router.delete("/conversations/:conversationId/messages", ratelimit_middleware_1.generalLimiter, chat_controllers_1.clearConversationMessages);
// Messages routes
router.get("/conversations/:conversationId/messages", ratelimit_middleware_1.generalLimiter, (0, cache_middleware_1.cacheMiddleware)({ ttl: 10 }), chat_controllers_1.getMessages);
router.post("/conversations/:conversationId/messages", ratelimit_middleware_1.interactionLimiter, upload_middleware_1.uploadChatMedia.array("files", 5), chat_controllers_1.sendMessage);
// Edit & delete routes
router.put("/messages/:messageId", ratelimit_middleware_1.interactionLimiter, chat_controllers_1.editMessage);
router.delete("/messages/:messageId", ratelimit_middleware_1.interactionLimiter, chat_controllers_1.deleteMessage);
router.delete("/messages/:messageId/delete-for-me", ratelimit_middleware_1.interactionLimiter, chat_controllers_1.deleteMessageForMe);
// Reaction route
router.post("/messages/:messageId/reactions", ratelimit_middleware_1.interactionLimiter, reaction_controllers_1.toggleReaction);
// Presence route
router.get("/users/:userId/presence", ratelimit_middleware_1.generalLimiter, (0, cache_middleware_1.cacheMiddleware)({ ttl: 60 }), chat_controllers_1.getUserPresence);
//# sourceMappingURL=chat.routes.js.map