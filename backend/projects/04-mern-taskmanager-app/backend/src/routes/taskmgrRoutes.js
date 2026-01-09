import express from "express";
import {
	getTasks,
	getTask,
	addTask,
	updateTask,
	adminDeleteTask,
	adminDeleteTasks,
	userDeleteTask,
	userDeleteTasks,
	viewDeletedTasks,
	restoreTask,
	restoreTasks,
} from "../controllers/taskmgrControllers.js";

const router = express.Router();

// routes
router.get("/taskmgr/get-tasks", getTasks);
router.get("/taskmgr/get-task/:id", getTask);

router.get("/taskmgr/view-deleted", viewDeletedTasks);
router.post("/taskmgr/restore-tasks/:id", restoreTask);
router.post("/taskmgr/restore-tasks", restoreTasks);

router.post("/taskmgr/add-task/", addTask);
router.put("/taskmgr/update-task/:id", updateTask);

router.delete("/taskmgr/admin-delete/:id", adminDeleteTask);
router.delete("/taskmgr/admin-delete-all", adminDeleteTasks);

router.delete("/taskmgr/user-delete/:id", userDeleteTask);
router.delete("/taskmgr/user-delete-all", userDeleteTasks);

export default router;
