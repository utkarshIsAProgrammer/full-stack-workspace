import express from "express";
import { signup, login, logout } from "../controllers/user.controllers.js";
import { auth } from "../middlewares/auth.middleware.js";
import { validateSignup } from "../middlewares/validateSignup.middleware.js";

const router = express.Router();

router.post("/signup", validateSignup, signup);
router.post("/login", login);
router.post("/logout", auth, logout);

export default router;
