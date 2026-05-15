import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import {
	sendMessage,
	getConversation,
} from "../controllers/message.controllers.js";

const router = express.Router();

router.post("/send", protectRoute, sendMessage);
router.get("/conversation/:userId", protectRoute, getConversation);

export { router as messageRoutes };
