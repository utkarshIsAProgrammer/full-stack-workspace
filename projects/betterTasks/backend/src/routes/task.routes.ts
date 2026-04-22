import express from "express";
import {
	addTask,
	updateTask,
	softDeleteTask,
	softDeleteAllTasks,
	deleteTask,
	deleteAllTasks,
	getTasks,
	restoreTask,
	restoreAllTasks,
} from "../controllers/task.controllers";
import { authUser } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/", authUser, addTask);

router.delete("/", authUser, softDeleteAllTasks);
router.delete("/permanent", authUser, deleteAllTasks);

router.delete("/:id", authUser, softDeleteTask);
router.delete("/:id/permanent", authUser, deleteTask);

router.put("/:id", authUser, updateTask);
router.patch("/:id", authUser, restoreTask);
router.patch("/", authUser, restoreAllTasks);

router.get("/", authUser, getTasks);

export { router as taskRoutes };
