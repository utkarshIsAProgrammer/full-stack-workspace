import express from "express";
import { getAll, signup, login, logout } from "../controllers/auth.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getAll);

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", protect, logout);

export { router as authRoutes };
