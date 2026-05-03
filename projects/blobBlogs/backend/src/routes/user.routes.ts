/**
 * @file user.routes.ts
 * @description Routes for user-related operations like account deletion.
 */

import express from "express";
import { deleteAccount } from "../controllers/user.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

// Delete user account (requires authentication)
router.delete("/delete-account/", protect, deleteAccount);

export { router as userRoutes };
