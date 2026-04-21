import type { Request, Response } from "express";
import { Task } from "../models/task.model";
import { taskSchema, updateTaskSchema } from "../schemas/task.schema";
import mongoose from "mongoose";

export const addTask = async (req: Request, res: Response) => {
	const result = taskSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid data!",
				errors: result.error.issues,
			});
		}

		const task = new Task(result.data);
		await task.save();

		res.status(201).json({
			success: true,
			message: "Task created successfully!",
			task,
		});
	} catch (err: any) {
		console.log(`Error in the signup controller! ${err.message}`);
		return res.status(500).json({ message: "Internal server error!" });
	}
};

export const updateTask = async (req: Request, res: Response) => {
	const result = updateTaskSchema.safeParse(req.body);
	const { id } = req.params;

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid data!",
				errors: result.error.issues,
			});
		}

		const updatedTask = await Task.findOneAndUpdate(
			{ _id: id, isDeleted: false },
			result.data,
			{
				returnDocument: "after",
				runValidators: true,
			},
		);
		if (!updatedTask) {
			return res
				.status(404)
				.json({ success: false, message: "Task not found!" });
		} else {
			return res.status(200).json({
				success: true,
				message: "Task updated successfully!",
				updatedTask,
			});
		}
	} catch (err: any) {
		console.log(`Error in the signup controller! ${err.message}`);
		return res.status(500).json({ message: "Internal server error!" });
	}
};

export const softDeleteTask = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const { id } = req.params;

	try {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid Task Id!",
			});
		}

		const deletedTask = await Task.findOneAndUpdate(
			{ _id: id, isDeleted: false },
			{ isDeleted: true },
			{ returnDocument: "after" },
		);

		if (!deletedTask) {
			return res.status(404).json({
				success: false,
				message: "Task not found or already deleted!",
			});
		} else {
			return res.status(200).json({
				success: true,
				message: "Task softly deleted successfully!",
				deletedTask,
			});
		}
	} catch (err: any) {
		console.log(`Error in the signup controller! ${err.message}`);
		return res.status(500).json({ message: "Internal server error!" });
	}
};

export const deleteTask = async (
	req: Request<{ id: string }>,
	res: Response,
) => {
	const { id } = req.params;

	try {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid Task Id!",
			});
		}

		const deletedTask = await Task.findByIdAndDelete(id);
		if (!deletedTask) {
			return res.status(404).json({
				success: false,
				message: "Task not found or already deleted permanently!",
			});
		} else {
			return res.status(200).json({
				success: true,
				message: "Task deleted successfully!",
			});
		}
	} catch (err: any) {
		console.log(`Error in the signup controller! ${err.message}`);
		return res.status(500).json({ message: "Internal server error!" });
	}
};

export const getTasks = async (req: Request, res: Response) => {
	try {
		const allTasks = await Task.find({ isDeleted: false }).sort({
			createdAt: -1,
		});
		res.status(200).json({
			success: true,
			message: "All tasks fetched successfully!",
			tasks: allTasks,
		});
	} catch (err: any) {
		console.log(`Error in the signup controller! ${err.message}`);
		return res.status(500).json({ message: "Internal server error!" });
	}
};

export const restoreTask = async (req: Request, res: Response) => {};
export const restoreAllTasks = async (req: Request, res: Response) => {};
