import express from "express";
import { deleteAccount } from "../controllers/user.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

// ! REMOVED USER ID (:id)
router.post("/delete-account/", protect, deleteAccount);

export { router as userRoutes };
