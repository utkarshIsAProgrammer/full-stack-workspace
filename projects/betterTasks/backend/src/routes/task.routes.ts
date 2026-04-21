import express from "express";
import {
	addTask,
	updateTask,
	softDeleteTask,
	deleteTask,
	getTasks,
	restoreTask,
	restoreAllTasks,
} from "../controllers/task.controllers";
import { authUser } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/", authUser, addTask);
router.put("/:id", authUser, updateTask);
router.delete("/:id", authUser, softDeleteTask);
router.delete("/:id/permanent", authUser, deleteTask);
router.get("/", authUser, getTasks);
router.post("/", authUser, restoreTask);
router.post("/", authUser, restoreAllTasks);

export { router as taskRoutes };
