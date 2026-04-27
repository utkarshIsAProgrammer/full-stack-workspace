import express from "express";
import {
	getAll,
	signup,
	login,
	logout,
	updatePassword,
} from "../controllers/auth.controllers";

const router = express.Router();

router.get("/", getAll);
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.post("/update-password", updatePassword);

export { router as authRoutes };
