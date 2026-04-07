import mongoose from "mongoose";
import Task from "../models/task.model.js";

export const getAllTasks = async (_, res) => {
	try {
		const tasks = await Task.find().sort({ createdAt: -1 });
		if (tasks.length === 0) {
			return res.status(200).json({
				success: true,
				message: "No tasks added yet!",
				tasks: [],
			});
		}

		res.status(200).json({
			success: true,
			message: "Tasks fetched successfully!",
			tasks,
		});
	} catch (err) {
		console.log(`Error in the getAllTasks controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const addTask = async (req, res) => {
	const { title, description, completed, dueDate } = req.body;
	try {
		if (!title) {
			return res
				.status(400)
				.json({ success: false, message: "Title is required!" });
		}

		const newTask = await Task.create({
			title,
			description,
			completed,
			dueDate,
		});
		res.status(201).json({
			success: true,
			message: "Task created successfully!",
			newTask,
		});
	} catch (err) {
		console.log(`Error in the addTask controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const updateTask = async (req, res) => {
	const { id } = req.params;
	const { title, description, completed, dueDate } = req.body;

	try {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid request ID!" });
		}

		if (!title || !description || !dueDate) {
			return res.status(400).json({
				success: false,
				message: "Please provide a field to update!",
			});
		}

		const updatedTask = await Task.findByIdAndUpdate(
			id,
			{ title, description, completed, dueDate },
			{ new: true },
		);

		if (!updatedTask) {
			return res
				.status(404)
				.json({ success: false, message: "Task not found!" });
		}

		res.status(200).json({
			success: true,
			message: "Task updated successfully!",
			updatedTask,
		});
	} catch (err) {
		console.log(`Error in the updateTask controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const deleteTask = async (req, res) => {
	const { id } = req.params;

	try {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid request ID!" });
		}

		const deletedTask = await Task.findByIdAndDelete(id);
		if (!deletedTask) {
			return res.status(404).json({
				success: false,
				message: "Task not found!",
			});
		}

		res.status(200).json({
			success: true,
			message: "Task deleted successfully!",
		});
	} catch (err) {
		console.log(`Error in the deleteTask controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
