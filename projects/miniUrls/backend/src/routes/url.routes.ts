import { Router } from "express";
import {
  createShortenUrl,
  handleRedirect,
} from "../controllers/url.controllers";

const router = Router();

// route for redirecting and shortening
router.get("/:code", handleRedirect);
router.post("/url/shorten", createShortenUrl);

export { router as urlRoutes };
