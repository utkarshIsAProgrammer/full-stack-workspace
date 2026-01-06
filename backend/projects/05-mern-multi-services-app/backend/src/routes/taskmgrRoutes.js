import express from "express";
import {
	getTasks,
	getTask,
	addTask,
	updateTask,
	deleteTask,
} from "../controllers/taskmgrControllers.js";

const router = express.Router();

// routes
router.get("/taskmgr/get-tasks", getTasks);
router.get("/taskmgr/get-task/:id", getTask);

router.post("/taskmgr/add-task/", addTask);
router.put("/taskmgr/update-task/:id", updateTask);

router.delete("/taskmgr/delete-task/:id", deleteTask);
// router.delete("/taskmgr/delete-all");

export default router;
