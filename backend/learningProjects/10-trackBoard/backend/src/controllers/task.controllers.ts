import type { Request, Response } from "express";
import { Task } from "../models/task.model.ts";
import {
	addTaskSchema,
	updateTaskSchema,
} from "../validations/task.validation.ts";

export const getTasks = async (req: Request, res: Response) => {
	try {
		const tasks = await Task.find({ user: req.user!._id });
		res.status(200).json({
			success: true,
			message: "All tasks fetched successfully!",
			tasks,
		});
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.error(`Error in getTasks: ${error.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const createTask = async (req: Request, res: Response) => {
	try {
		const validation = addTaskSchema.safeParse(req.body);
		if (!validation.success) {
			return res
				.status(400)
				.json({ success: false, errors: validation.error.format() });
		}

		const task = await Task.create({
			...validation.data,
			user: req.user!._id,
		});

		res.status(201).json({
			success: true,
			message: "Task created successfully!",
			task,
		});
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.error(`Error in createTask: ${error.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const updateTask = async (req: Request, res: Response) => {
	try {
		const validation = updateTaskSchema.safeParse(req.body);
		if (!validation.success) {
			return res
				.status(400)
				.json({ success: false, errors: validation.error.format() });
		}

		const task = await Task.findOneAndUpdate(
			{ _id: req.params.id, user: req.user!._id },
			validation.data,
			{ new: true, runValidators: true },
		);

		if (!task) {
			return res.status(404).json({
				success: false,
				message: "Task not found or unauthorized!",
			});
		}

		res.status(200).json({
			success: true,
			message: "Task updated successfully!",
			task,
		});
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.error(`Error in updateTask: ${error.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const deleteTask = async (req: Request, res: Response) => {
	try {
		const task = await Task.findOneAndDelete({
			_id: req.params.id,
			user: req.user!._id,
		});

		if (!task) {
			return res.status(404).json({
				success: false,
				message: "Task not found or you don't have permission!",
			});
		}

		res.status(200).json({
			success: true,
			message: "Task deleted successfully!",
		});
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.error(`Error in deleteTask: ${error.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};
