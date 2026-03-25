import express from "express";
import { getUsersForSidebar } from "../controllers/user.controllers.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getUsersForSidebar);

export { router as userRoutes };
