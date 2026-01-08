import Task from "../models/Taskmgr.js";

// get all tasks
export async function getTasks(_, res) {
	try {
		const tasks = await Task.find();
		if (tasks.length === 0) {
			res.status(200).json({
				message: "No available tasks!",
			});
		} else {
			res.status(200).json(tasks);
		}
	} catch (err) {
		console.log("Error in the getTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// get task from id
export async function getTask(req, res) {
	try {
		const task = await Task.findById(req.params.id);
		if (!task) {
			return res
				.status(404)
				.json({ message: "Unable to find task as it don't exist!" });
		}

		res.status(200).json(task);
	} catch (err) {
		if (err.name === "CastError") {
			return res.status(400).json({ message: "Invalid task ID!" });
		}

		console.log("Error in the getTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// add new task
export async function addTask(req, res) {
	try {
		const savedTask = await Task.create(req.body);
		res.status(201).json(savedTask);
	} catch (err) {
		if (err.name === "ValidationError") {
			return res.status(400).json({
				message: "Validation failed!",
				errors: err.errors,
			});
		}
		console.log("Error in the addTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// update task
export async function updateTask(req, res) {
	try {
		const updatedTask = await Task.findByIdAndUpdate(
			req.params.id,
			req.body,
			{
				new: true,
				runValidators: true,
			}
		);

		if (!updatedTask) {
			return res
				.status(404)
				.json({ message: "Task not found to be updated!" });
		}

		res.status(200).json(updatedTask);
	} catch (err) {
		if (err.name === "CastError") {
			return res.status(400).json({ message: "Invalid task ID!" });
		}
		if (err.name === "ValidationError") {
			return res
				.status(400)
				.json({ message: "Validation Error!", errors: err.errors });
		}
		console.log("Error in the updateTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// hard delete task from id by admin
export async function adminDeleteTask(req, res) {
	try {
		const task = await Task.findByIdAndDelete(req.params.id);
		if (!task) {
			return res
				.status(404)
				.json({ message: "ADMIN: Task not found to be deleted!" });
		}

		res.status(200).json({ message: "Task deleted successfully!" });
	} catch (err) {
		console.log("Error in the adminDeleteTask controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// hard delete all tasks by admin
export async function adminDeleteTasks(_, res) {
	try {
		const tasks = await Task.deleteMany({});
		if (tasks.deletedCount === 0) {
			return res
				.status(404)
				.json({ message: "ADMIN: No tasks to be deleted!" });
		}

		res.status(200).json({ message: "All tasks deleted successfully!" });
	} catch (err) {
		console.log("Error in the adminDeleteTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// soft delete task from id by user
export async function userDeleteTask(req, res) {
	try {
		const task = await Task.delete({ _id: req.params.id });

		if (task.deletedCount === 0) {
			return res
				.status(404)
				.json({ message: "Task cannot be deleted as it don't exist!" });
		}

		res.status(200).json({ message: "Task softly deleted!" });
	} catch (err) {
		console.log("Error in the userDelete controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// soft delete all tasks by user
export async function userDeleteTasks(_, res) {
	try {
		const tasks = await Task.delete({});

		if (tasks.deletedCount === 0) {
			return res.status(404).json({
				message: "Tasks cannot be deleted as they don't exist!",
			});
		}

		res.status(200).json({ message: "Task softly deleted!" });
	} catch (err) {
		console.log("Error in the userDelete controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// view all deleted tasks
export async function viewDeletedTasks(_, res) {
	try {
		const deletedTasks = await Task.findDeleted({});

		if (deletedTasks.length === 0) {
			return res
				.status(404)
				.json({ message: "Bin is empty, no tasks to be displayed!" });
		}

		res.status(200).json(deletedTasks);
	} catch (err) {
		console.log("Error in the viewDeletedTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// restore task by id
export async function restoreTask(req, res) {
	try {
		const task = await Task.restore({ _id: req.params.id });

		if (task.nModified === 0) {
			return res
				.status(404)
				.json({ message: "Task not found in the bin!" });
		}

		res.status(200).json({ message: "Task restored successfully!" });
	} catch (err) {
		console.log("Error in the restoreTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// restore all tasks
export async function restoreTasks(_, res) {
	try {
		const tasks = await Task.restore({});

		if (tasks.nModified === 0) {
			return res.status(404).json({ message: "Bin is empty!" });
		}

		res.status(200).json({ message: "All tasks restored successfully!" });
	} catch (err) {
		console.log("Error in the restoreTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}
