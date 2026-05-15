import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { updateProfile } from "../controllers/user.controllers.js";

const router = express.Router();

router.put("/update", protectRoute, updateProfile);

export { router as userRoutes };
