import express from "express";
import { signup } from "../controllers/auth.controllers.js";

const router = express.Router();

router.post("/signup", signup);
// router.get("/login", login);
// router.get("/logout", logout);

export { router as authRoutes };
