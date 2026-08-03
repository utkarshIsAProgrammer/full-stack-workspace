import express from "express";
import { googleAuth, googleAuthCallback } from "../controllers/oauth.controllers";

const router = express.Router();

// Initiate Google OAuth login
router.get("/google", googleAuth);

// Google OAuth callback
router.get("/google/callback", googleAuthCallback);

export { router as oauthRoutes };
