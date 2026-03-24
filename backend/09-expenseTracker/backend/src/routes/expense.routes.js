import express from "express";
import {
	getAllExpenses,
	addExpense,
	updateExpense,
	deleteExpense,
} from "../controllers/expense.controllers.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getAllExpenses);
router.post("/add", protectRoute, addExpense);
router.put("/update/:id", protectRoute, updateExpense);
router.delete("/delete/:id", protectRoute, deleteExpense);

export { router as expenseRoutes };
