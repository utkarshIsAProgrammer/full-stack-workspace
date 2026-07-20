import express from "express";
import {
  createAudioRoom,
  getLiveRooms,
  getAudioRoom,
  joinAudioRoom,
  leaveAudioRoom,
  inviteToRoom,
} from "../controllers/audioRoom.controllers";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import { generalLimiter, interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.get("/live", optionalAuth, generalLimiter, getLiveRooms);
router.get("/:roomId", optionalAuth, generalLimiter, getAudioRoom);

router.use(protect);

router.post("/", generalLimiter, createAudioRoom);
router.post("/:roomId/join", interactionLimiter, joinAudioRoom);
router.post("/:roomId/leave", interactionLimiter, leaveAudioRoom);
router.post("/:roomId/invite/:userId", interactionLimiter, inviteToRoom);

export { router as audioRoomRoutes };
