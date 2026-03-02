import express from "express";
import { signup, login, logout } from "../controllers/auth.controllers.js";
import { validate } from "../middlewares/validate.middleware.js";
import signupSchema from "../validators/auth.validator.js";

const router = express.Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/login", login);
// router.post("/logout", logout);

export { router as authRoutes };
