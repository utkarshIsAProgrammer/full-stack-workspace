import express from "express";
import { protectRoute } from "../middlewares/auth.middlewares.js";
import {
	getUsersForSidebar,
	getMessages,
	sendMessages,
} from "../controllers/message.controllers.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send", protectRoute, sendMessages);

export { router as messageRoutes };
