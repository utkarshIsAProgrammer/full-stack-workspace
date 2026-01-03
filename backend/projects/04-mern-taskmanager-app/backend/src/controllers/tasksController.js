import mongoose from "mongoose";
import Task from "../models/Task.js";

export async function getAllTasks(_, res) {
	try {
		const tasks = await Task.find();
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

export async function deleteTask(req, res) {
	const id = req.params.id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ message: "Invalid Task Id!" });
	}

	try {
		const deletedTask = await Task.findByIdAndDelete(id);

		if (!deletedTask) {
			return res.status(404).json({ message: "Task not found!" });
		}

		res.status(200).json({ message: "Task deleted successfully!" });
	} catch (err) {
		console.log("Error in the deleteTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}
