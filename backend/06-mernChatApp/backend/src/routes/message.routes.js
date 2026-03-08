import express from "express";
import { sendMessage } from "../controllers/message.controllers.js";

const router = express.Router();

router.post("/send", sendMessage);

export { router as messageRoutes };
