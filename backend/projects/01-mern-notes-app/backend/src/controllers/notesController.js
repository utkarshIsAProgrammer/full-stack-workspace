import Note from "../models/Note.js";

// controllers
export async function getAllNotes(_, res) {
	try {
		const notes = await Note.find().sort({ createdAt: -1 }); // -createdAt: -1 sorts in descending order
		res.status(200).json(notes);
	} catch (err) {
		console.error("Error in the getAllNotes controller!", err);
		res.status(500).json({ message: "Internal Server error" });
	}
}

export async function getNoteById(req, res) {
	try {
		const note = await Note.findById(req.params.id);
		res.status(200).json(note);
	} catch (err) {
		console.error("Error in the getNoteById controller!", err);
		res.status(500).json({ message: "Internal Server error" });
	}
}

export async function createNote(req, res) {
	try {
		const { title, content } = req.body;
		const newNote = new Note({ title, content });
		const savedNote = await newNote.save();
		res.status(201).json(savedNote);
	} catch (err) {
		console.error("Error in the createNote controller!", err);
		res.status(500).json({ message: "Internal Server error" });
	}
}

export async function updateNote(req, res) {
	try {
		const { title, content } = req.body;
		const updatedNote = await Note.findByIdAndUpdate(req.params.id, {
			title,
			content,
		});
		res.status(200).json(updatedNote);
	} catch (err) {
		console.error("Error in the updateNote controller!", err);
		res.status(500).json({ message: "Internal Server error" });
	}
}

export async function deleteNote(req, res) {
	try {
		await Note.findByIdAndDelete(req.params.id);
		res.status(200).json({ message: "Note deleted successfully!" });
	} catch (err) {
		console.error("Error in the deleteNote controller!", err);
		res.status(500).json({ message: "Internal Server error" });
	}
}
