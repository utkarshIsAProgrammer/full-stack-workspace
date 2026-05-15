import express from "express";
import {
	getTask,
	getTasks,
	addTask,
	updateTask,
	deleteTask,
} from "../controllers/task.controllers.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", auth, getTasks);
router.get("/:id", auth, getTask);
router.post("/", auth, addTask);
router.put("/:id", auth, updateTask);
router.delete("/:id", auth, deleteTask);

export default router;
