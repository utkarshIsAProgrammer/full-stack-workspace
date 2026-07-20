import express from "express";
import {
  createCollection,
  getCollections,
  addPostToCollection,
  removePostFromCollection,
  deleteCollection,
  getCollectionPosts,
} from "../controllers/collection.controllers";
import { protect } from "../middlewares/auth.middleware";
import { generalLimiter, interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();
router.use(protect);

router.post("/", generalLimiter, createCollection);
router.get("/", generalLimiter, getCollections);
router.get("/:collectionId", generalLimiter, getCollectionPosts);
router.post("/:collectionId/posts/:postId", interactionLimiter, addPostToCollection);
router.delete("/:collectionId/posts/:postId", interactionLimiter, removePostFromCollection);
router.delete("/:collectionId", generalLimiter, deleteCollection);

export { router as collectionRoutes };
