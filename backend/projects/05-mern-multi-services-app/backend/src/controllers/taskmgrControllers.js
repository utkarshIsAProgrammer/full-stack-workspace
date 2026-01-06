import Task from "../models/TaskmgrSchema.js";

export async function getTasks(_, res) {
	try {
		const tasks = await Task.find();
		res.status(200).json(tasks);
	} catch (err) {
		console.log("Error in the getTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function getTask(req, res) {
	const id = req.params.id;
	try {
		const task = await Task.findById(id);
		res.status(200).json(task);
	} catch (err) {
		console.log("Error in the getTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function addTask(req, res) {
	const { title, description, status, priority, dueDate } = req.body;

	try {
		const newTask = new Task({
			title,
			description,
			status,
			priority,
			dueDate,
		});

		const savedTask = await newTask.save();
		res.status(201).json(savedTask);
	} catch (err) {
		console.log("Error in the addTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function updateTask(req, res) {
	const { title, description, status, priority, dueDate } = req.body;
	const id = req.params.id;

	try {
		const updatedTask = await Task.findByIdAndUpdate(
			id,
			{
				title,
				description,
				status,
				priority,
				dueDate,
			},
			{ new: true }
		);
		res.status(200).json(updatedTask);
	} catch (err) {
		console.log("Error in the updateTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function deleteTask(req, res) {
	const id = req.params.id;

	try {
		await Task.findByIdAndDelete(id);
		res.status(200).json({ message: "Task deleted successfully!" });
	} catch (err) {
		console.log("Error in the deleteTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}
