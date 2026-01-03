import express from "express";
import {
	getAllTasks,
	getTaskById,
	addTask,
	updateTask,
	deleteTask,
} from "../controllers/tasksController.js";

const router = express.Router();

router.get("/get-all-tasks", getAllTasks);
router.get("/get-task-by-id/:id", getTaskById);
router.post("/add-task/", addTask);
router.put("/update-task/:id", updateTask);
router.delete("/delete-task/:id", deleteTask);

// filter task by status, priority, due date
// toggle completion status
// soft delete

export default router;
