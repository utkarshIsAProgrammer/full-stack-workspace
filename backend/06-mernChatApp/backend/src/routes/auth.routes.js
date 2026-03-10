import express from "express";
import {
	signup,
	login,
	logout,
	updateProfile,
} from "../controllers/auth.controllers.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.put("/update-profile", updateProfile);
export { router as authRoutes };
