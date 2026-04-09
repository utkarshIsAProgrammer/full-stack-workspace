import express from "express";
import {
	getTasks,
	createTask,
	updateTask,
	deleteTask,
} from "../controllers/task.controllers.ts";
import { isAuthenticated } from "../middlewares/auth.middleware.ts";

const router = express.Router();

router.get("/get", isAuthenticated, getTasks);
router.post("/create", isAuthenticated, createTask);
router.put("/update/:id", isAuthenticated, updateTask);
router.delete("/delete/:id", isAuthenticated, deleteTask);

export { router as taskRoutes };
