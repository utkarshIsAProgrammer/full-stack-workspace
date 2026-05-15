import express from "express";
import { signup, login, logout } from "../controllers/auth.controllers.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.get("/me", protectRoute, (req, res) => {
	res.json({
		success: true,
		user: req.user,
	});
});

export { router as authRoutes };
