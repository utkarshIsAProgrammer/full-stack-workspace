import express from "express";
import { signup, signin, logout } from "../controllers/auth.controllers.js";

export const router = express.Router();

router.get("/signup", signup);
router.get("/signin", signin);
router.get("/logout", logout);
