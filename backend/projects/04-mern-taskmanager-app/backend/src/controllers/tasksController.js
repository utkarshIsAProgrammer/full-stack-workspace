import mongoose from "mongoose";
import Task from "../models/Task.js";

// controllers
export async function getAllTasks(_, res) {
	try {
		const tasks = await Task.find().sort({ createdAt: -1 });

		if (tasks.length === 0) {
			return res.status(404).json({ message: "No tasks are present!" });
		}

		res.status(200).json(tasks);
	} catch (err) {
		console.log("Error in the getAllTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function getTaskById(req, res) {
	const id = req.params.id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ message: "Invalid Task Id!" });
	}

	try {
		const task = await Task.findById(id);

		if (!task) {
			return res.status(404).json({ message: "Task not found!" });
		}

		res.status(200).json(task);
	} catch (err) {
		console.log("Error in the getTaskById controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function getDeletedTasks(_, res) {
	try {
		const deletedTasks = await Task.findDeleted().sort({ deletedAt: -1 });
		res.status(200).json({ deletedTasks });
	} catch (err) {
		console.log("Error in the getDeletedTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function addTask(req, res) {
	const { title, description, status, dueDate, priority } = req.body;

	if (!title) {
		return res
			.status(400)
			.json({ message: "Please provide title for the task!" });
	}

	try {
		const newTask = new Task({
			title,
			description,
			status,
			dueDate,
			priority,
		});

		const savedTask = await newTask.save();
		res.status(201).json(savedTask);
	} catch (err) {
		if (err.name === "ValidationError") {
			return res.status(400).json({
				message:
					"Invalid status, please provide [todo, in progress, done]",
			});
		}

		console.log("Error in the addTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function updateTask(req, res) {
	const id = req.params.id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ message: "Invalid Task Id!" });
	}

	const { title, description, status, dueDate, priority } = req.body;

	try {
		const updatedTask = await Task.findByIdAndUpdate(
			id,
			{
				title,
				description,
				status,
				dueDate,
				priority,
			},
			{ new: true, runValidators: true } // always show updated task and run validators like enum and required
		);

		if (!updatedTask) {
			return res.status(404).json({ message: "Task not found!" });
		}

		res.status(200).json(updatedTask);
	} catch (err) {
		if (err.name === "ValidationError") {
			return res.status(400).json({
				message:
					"Invalid status, please provide [todo, in progress, done]",
			});
		}

		console.log("Error in the updateTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function softDeleteTask(req, res) {
	const id = req.params.id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ message: "Invalid Task Id!" });
	}

	try {
		const task = await Task.findById(id);

		if (!task) {
			return res.status(404).json({ message: "Task not found!" });
		}

		await task.delete();
		res.status(200).json({
			message: "Task is softly deleted!",
		});
	} catch (err) {
		console.log("Error in the softDeleteTask controller", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function deleteTask(req, res) {
	const id = req.params.id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ message: "Invalid Task Id!" });
	}

	try {
		const task = await Task.findByIdAndDelete(id);

		if (!task) {
			return res.status(404).json({ message: "Task not found!" });
		}

		res.status(200).json({ message: "Task deleted successfully!" });
	} catch (err) {
		console.log("Error in the deleteTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function deleteAllTasks(_, res) {
	try {
		await Task.deleteMany({});
		res.status(200).json({ message: "All tasks deleted successfully!" });
	} catch (err) {
		console.log("Error in the deleteAllTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function restoreAllTasks(_, res) {
	try {
		const tasks = await Task.restore();

		if (tasks.matchedCount === 0) {
			return res.status(404).json({
				message: "No deleted tasks found to restore!",
			});
		}

		res.status(200).json({ message: "All tasks restored successfully!" });
	} catch (err) {
		console.log("Error in the restoreAllTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function restoreTaskById(req, res) {
	const id = req.params.id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ message: "Invalid Task Id!" });
	}

	try {
		const task = await Task.findOneWithDeleted({ _id: id });

		if (!task) {
			return res.status(404).json({ message: "Task not found!" });
		}

		const restoredTask = await task.restore();
		res.status(200).json(restoredTask);
	} catch (err) {
		console.log("Error in the restoreTaskById controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}
