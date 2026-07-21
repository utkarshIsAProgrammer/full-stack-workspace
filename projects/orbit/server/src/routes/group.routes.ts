import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { generalLimiter, interactionLimiter } from "../middlewares/ratelimit.middleware";
import {
  createGroup,
  getMyGroups,
  updateGroup,
  addGroupMembers,
  removeGroupMembers,
  deleteGroup,
  getGroupMessages,
  sendGroupMessage,
} from "../controllers/group.controller";

const router = Router();
router.use(protect, generalLimiter);

router.post("/", interactionLimiter, createGroup);
router.get("/", getMyGroups);
router.put("/:groupId", interactionLimiter, updateGroup);
router.post("/:groupId/add", interactionLimiter, addGroupMembers);
router.post("/:groupId/remove", interactionLimiter, removeGroupMembers);
router.delete("/:groupId", deleteGroup);
router.get("/:groupId/messages", getGroupMessages);
router.post("/:groupId/messages", interactionLimiter, sendGroupMessage);

export default router;
