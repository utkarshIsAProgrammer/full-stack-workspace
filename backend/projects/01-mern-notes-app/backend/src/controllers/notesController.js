import Note from "../models/Note.js";

// controllers
export async function getAllNotes(_, res) {
	try {
		const notes = await Note.find().sort({ createdAt: -1 }); // -createdAt: -1 sorts in descending order

		if (notes.length === 0) {
			return res
				.status(404)
				.json({ message: "No notes found to be displayed!" });
		}

		res.status(200).json(notes);
	} catch (err) {
		console.error("Error in the getAllNotes controller!", err);
		res.status(500).json({ message: "Internal Server error" });
	}
}

export async function getNoteById(req, res) {
	try {
		const note = await Note.findById(req.params.id);

		if (!note) {
			return res
				.status(404)
				.json({ message: "No note found to be displayed!" });
		}

		res.status(200).json(note);
	} catch (err) {
		if (err.name === "CastError") {
			return res.status(400).json({ message: "Invalid ID format" });
		}
		console.error("Error in the getNoteById controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function createNote(req, res) {
	try {
		const { title, content } = req.body;
		const newNote = new Note({ title, content });
		const savedNote = await newNote.save();
		res.status(201).json(savedNote);
	} catch (err) {
		console.error("Error in the createNote controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function updateNote(req, res) {
	try {
		const { title, content } = req.body;
		const updatedNote = await Note.findByIdAndUpdate(
			req.params.id,
			{
				title,
				content,
			},
			{ new: true }
		);

		if (!updatedNote) {
			return res
				.status(404)
				.json({ message: "Note not found to be updated!" });
		}

		res.status(200).json(updatedNote);
	} catch (err) {
		if (err.name === "CastError") {
			return res.status(400).json({ message: "Invalid ID format" });
		}
		console.error("Error in the updateNote controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function adminDeleteNote(req, res) {
	const id = req.params.id;
	try {
		const note = await Note.findByIdAndDelete(id);
		if (!note) {
			return res
				.status(404)
				.json({ message: "ADMIN: No note found to be deleted!" });
		}

		res.status(200).json({ message: "ADMIN: Note deleted successfully!" });
	} catch (err) {
		if (err.name === "CastError") {
			return res.status(400).json({ message: "Invalid ID format" });
		}
		console.error("Error in the deleteNote controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function adminDeleteNotes(_, res) {
	try {
		const notes = await Note.deleteMany({});

		if (notes.deletedCount === 0) {
			return res
				.status(404)
				.json({ message: "ADMIN: No notes found to be deleted!" });
		}

		res.status(200).json({
			message: `ADMIN: ${notes.deletedCount} notes deleted successfully!`,
		});
	} catch (err) {
		console.log("Error in the adminDeleteNotes controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function userDeleteNote(req, res) {
	const id = req.params.id;
	try {
		const note = await Note.delete({ _id: id });

		if (note.modifiedCount === 0) {
			return res.status(404).json({
				message: "No note found to be deleted!",
			});
		}

		res.status(200).json({ message: "Note softly deleted!" });
	} catch (err) {
		if (err.name === "CastError") {
			return res.status(400).json({ message: "Invalid ID format" });
		}
		console.log("Error in the userDeleteNote controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function userDeleteNotes(_, res) {
	try {
		const notes = await Note.delete({});

		if (notes.modifiedCount === 0) {
			return res
				.status(404)
				.json({ message: "No notes found to be deleted!" });
		}

		res.status(200).json({
			message: `${notes.modifiedCount} notes softly deleted!`,
		});
	} catch (err) {
		console.log("Error in the userDeleteNotes controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function viewDeletedNotes(_, res) {
	try {
		const deletedTasks = await Note.findDeleted({});

		if (deletedTasks.length === 0) {
			return res.status(404).json({ message: "No deleted notes found!" });
		}

		res.status(200).json(deletedTasks);
	} catch (err) {
		console.log("Error in the viewDeletedNotes controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function restoreNote(req, res) {
	const id = req.params.id;
	try {
		const note = await Note.restore({ _id: id });

		if (note.modifiedCount === 0) {
			return res
				.status(404)
				.json({ message: "No note found or not in trash!" });
		}

		res.status(200).json({ message: "Note restored successfully!" });
	} catch (err) {
		if (err.name === "CastError") {
			return res.status(400).json({ message: "Invalid ID format" });
		}
		console.log("Error in the restoreNote controller!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function restoreNotes(_, res) {
	try {
		const notes = await Note.restore({});

		if (notes.modifiedCount === 0) {
			return res
				.status(404)
				.json({ message: "No note found or not in trash!" });
		}

		res.status(200).json({ message: "Notes restored successfully!" });
	} catch (err) {
		console.log("Error in the restoreNotes router!", err.message);
		res.status(500).json({ message: "Internal Server error!" });
	}
}
