import express from "express";
import { signup, login, logout, me } from "../controllers/auth.controllers";
import { authUser } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/me", authUser, me);
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

export { router as authRoutes };
