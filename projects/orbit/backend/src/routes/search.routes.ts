import express from "express";
import { searchUsers, searchPosts } from "../controllers/search.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/users", protect, searchUsers);
router.get("/posts", protect, searchPosts);

export { router as searchRoutes };
