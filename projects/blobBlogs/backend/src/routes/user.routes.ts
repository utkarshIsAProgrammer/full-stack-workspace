import express from "express";
import {
  getAll,
  deleteAccount,
  shareProfile,
} from "../controllers/user.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getAll);
router.delete("/delete-account/", protect, deleteAccount);
router.post("/:userId/share", protect, shareProfile);

export { router as userRoutes };
