import Note from "../models/Note.js";

// controllers
export async function getAllNotes(_, res) {
	try {
		const notes = await Note.find();
		res.status(200).json(notes);
	} catch (err) {
		console.error("Error in the getAllNotes controller!", err);
		res.status(500).json({ message: "Internal Server error" });
	}
}

export async function createNote(req, res) {
	try {
		const { title, content } = req.body;
		const newNote = new Note({ title, content });
		await newNote.save();
		res.status(201).json({ message: "Note created successfully!" });
	} catch (err) {
		console.error("Error in the createNote controller!", err);
		res.status(500).json({ message: "Internal Server error" });
	}
}

export async function updateNote(req, res) {
	res.send("Note updated successfully!");
}

export async function deleteNote(req, res) {
	res.send("Note deleted successfully!");
}
