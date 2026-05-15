import express from "express";
import {
	home,
	submitFeedback,
	showAllFeedbacks,
} from "../controllers/feedback.controllers.js";

const router = express.Router();

router.get("/", home);
router.post("/feedback", submitFeedback);
router.get("/feedback", showAllFeedbacks);

export { router as feedbackRoutes };
