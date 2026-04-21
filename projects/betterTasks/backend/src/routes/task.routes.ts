import express from "express";
import {
	addTask,
	updateTask,
	softDeleteTask,
	deleteTask,
	getTasks,
} from "../controllers/task.controllers";

const router = express.Router();

router.post("/", addTask);
router.put("/:id", updateTask);
router.delete("/:id", softDeleteTask);
router.delete("/:id/permanent", deleteTask);
router.get("/", getTasks);

export { router as taskRoutes };
