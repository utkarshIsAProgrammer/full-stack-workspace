import express from "express";
import { deleteAccount } from "../controllers/user.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();
router.post("/delete-account/:id", protect, deleteAccount);

export { router as userRoutes };
