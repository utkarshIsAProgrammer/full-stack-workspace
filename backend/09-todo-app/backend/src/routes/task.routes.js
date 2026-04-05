import express from "express";
import {
	getAllTasks,
	addTask,
	updateTask,
	deleteTask,
} from "../controllers/task.controllers.js";

const router = express.Router();

router.get("/get", getAllTasks);
router.post("/add", addTask);
router.put("/update/:id", updateTask);
router.delete("/delete/:id", deleteTask);

export { router as taskRoutes };
