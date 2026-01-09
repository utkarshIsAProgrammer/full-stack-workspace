import Task from "../models/Taskmgr.js";

// get all tasks
export async function getTasks(_, res) {
	try {
		const tasks = await Task.find();
		if (tasks.length === 0) {
			res.status(200).json({
				message: "No available tasks to be displayed!",
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
	const id = req.params.id;

	try {
		const task = await Task.findById(id);
		if (!task) {
			return res.status(404).json({ message: "Task don't exist!" });
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
	const { title, description, status, priority, dueDate } = req.body;
	try {
		const savedTask = await Task.create({
			title,
			description,
			status,
			priority,
			dueDate,
		});
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
	const id = req.params.id;
	const { title, description, status, priority, dueDate } = req.body;

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
			{
				new: true,
				runValidators: true,
			}
		);

		if (!updatedTask) {
			return res.status(404).json({
				message: "Unable to find the task with task to be updated!",
			});
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
	const id = req.params.id;

	try {
		const task = await Task.findByIdAndDelete(id);
		if (!task) {
			return res.status(404).json({
				message: "ADMIN: Task is already deleted or don't exist!",
			});
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

		res.status(200).json({
			message: `${tasks.deletedCount} tasks deleted successfully!`,
		});
	} catch (err) {
		console.log("Error in the adminDeleteTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

// soft delete task from id by user
export async function userDeleteTask(req, res) {
	const id = req.params.id;
	try {
		const task = await Task.delete({ _id: id });

		if (task.deletedCount === 0) {
			return res.status(404).json({
				message: "Task don't exist unable to delete the task!",
			});
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

		if (tasks.modifiedCount === 0) {
			return res.status(404).json({
				message: "Unable to delete tasks, tasks don't exist!!",
			});
		}

		res.status(200).json({
			message: `${tasks.modifiedCount} tasks softly deleted!`,
		});
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
				.json({ message: "There are no deleted tasks in the trash!" });
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
		const id = req.params.id;
		const task = await Task.restore({ _id: id });

		if (task.modifiedCount === 0) {
			return res
				.status(404)
				.json({ message: "Unable to find the task in the trash!" });
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

		if (tasks.modifiedCount === 0) {
			return res
				.status(404)
				.json({ message: "No deleted tasks in the trash!" });
		}

		res.status(200).json({
			message: `${tasks.modifiedCount} tasks restored successfully!`,
		});
	} catch (err) {
		console.log("Error in the restoreTasks controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}
