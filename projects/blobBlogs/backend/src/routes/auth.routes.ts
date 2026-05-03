/**
 * @file auth.routes.ts
 * @description Authentication routes for signup, login, and logout.
 */

import express from "express";
import { getAll, signup, login, logout } from "../controllers/auth.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

// GET all users (likely for development/admin use)
router.get("/", getAll);

// POST signup new user
router.post("/signup", signup);
// POST login user
router.post("/login", login);
// POST logout user (requires authentication)
router.post("/logout", protect, logout);

export { router as authRoutes };
