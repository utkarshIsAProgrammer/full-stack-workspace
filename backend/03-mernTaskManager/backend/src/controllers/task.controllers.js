import Task from "../models/task.model.js";
import mongoose from "mongoose";

export const getTask = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({
			success: false,
			message: "Invalid task id!",
		});
	}

	try {
		const task = await Task.findOne({ _id: id, user: req.user });
		if (!task) {
			return res
				.status(404)
				.json({ success: false, message: "Task not found!" });
		}

		res.status(200).json({
			success: true,
			message: "Task fetched successfully!",
			task,
		});
	} catch (err) {
		console.log(`Error in the getTask controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};

export const getTasks = async (req, res) => {
	try {
		const tasks = await Task.find({ user: req.user }).sort({
			createdAt: -1,
		});

		res.status(200).json({
			success: true,
			message: "Tasks fetched successfully!",
			tasks,
		});
	} catch (err) {
		console.log(`Error in the getTasks controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};

export const addTask = async (req, res) => {
	const { title, description, dueDate, priority, status } = req.body;

	try {
		const task = await Task.create({
			title,
			description,
			dueDate,
			priority,
			status,
			user: req.user, // connect task to logged in user, (user id)
		});

		if (!title)
			return res
				.status(400)
				.json({ success: false, message: "Title is required!" });

		res.status(201).json({
			success: true,
			message: "Task successfully created!",
			task,
		});
	} catch (err) {
		console.log(`Error in the addTask controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};

export const updateTask = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({
			success: false,
			message: "Invalid task id!",
		});
	}

	const { title, description, dueDate, priority, status } = req.body;
	try {
		const task = await Task.findOneAndUpdate(
			{ _id: id, user: req.user },
			{ title, description, dueDate, priority, status },
			{ new: true, runValidators: true },
		);
		if (!task) {
			return res
				.status(404)
				.json({ success: false, message: "Task not found!" });
		}

		res.status(200).json({ success: true, task });
	} catch (err) {
		console.log(`Error in the updateTask controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};

export const deleteTask = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({
			success: false,
			message: "Invalid task id!",
		});
	}

	try {
		const task = await Task.findOneAndDelete({ _id: id, user: req.user });
		if (!task) {
			return res
				.status(404)
				.json({ success: false, message: "Task not found!" });
		}

		res.status(200).json({
			success: true,
			message: "Task deleted successfully!",
		});
	} catch (err) {
		console.log(`Error in the deleteTask controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};
