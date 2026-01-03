import express from "express";
import {
	getAllTasks,
	getTaskById,
	getDeletedTasks,
	addTask,
	updateTask,
	softDeleteTask,
	deleteTask,
	deleteAllTasks,
	restoreAllTasks,
	restoreTaskById,
} from "../controllers/tasksController.js";

const router = express.Router();

// routes
router.get("/get-all", getAllTasks);
router.get("/get-by-id/:id", getTaskById);
router.get("/get-deleted", getDeletedTasks);
router.post("/add/", addTask);
router.put("/update/:id", updateTask);
router.delete("/soft-delete/:id", softDeleteTask);
router.delete("/delete/:id", deleteTask);
router.delete("/delete-all", deleteAllTasks);
router.post("/restore-all", restoreAllTasks);
router.post("/restore-by-id/:id", restoreTaskById);

export default router;
