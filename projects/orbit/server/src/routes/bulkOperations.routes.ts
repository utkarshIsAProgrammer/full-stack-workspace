import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";
import { bulkDeletePosts, bulkReadNotifications, bulkDeleteConversations } from "../controllers/bulkOperations.controller";

const router = Router();
router.use(protect, interactionLimiter);
router.post("/posts", bulkDeletePosts);
router.post("/notifications", bulkReadNotifications);
router.post("/chats", bulkDeleteConversations);

export default router;
