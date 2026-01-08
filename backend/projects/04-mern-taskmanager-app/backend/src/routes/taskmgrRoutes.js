import express from "express";
import {
	getTasks,
	getTask,
	addTask,
	updateTask,
	adminDeleteTask,
	adminDeleteTasks,
} from "../controllers/taskmgrControllers.js";

const router = express.Router();

// routes
router.get("/taskmgr/get-tasks", getTasks);
router.get("/taskmgr/get-task/:id", getTask);

router.post("/taskmgr/add-task/", addTask);
router.put("/taskmgr/update-task/:id", updateTask);

router.delete("/taskmgr/admin-delete/:id", adminDeleteTask);
router.delete("/taskmgr/admin-delete-all", adminDeleteTasks);

export default router;
