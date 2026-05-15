import Note from "../models/noteModel.js";

export const getNote = async (req, res) => {
	const { id } = req.params;

	try {
		const note = await Note.findById(id);

		if (!note) {
			res.status(404).json({ message: "Note not found" });
		}

		res.status(200).json(note);
	} catch (err) {
		console.log("Error in the getNote controller!", err.message);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const getNotes = async (_, res) => {
	try {
		const notes = await Note.find().sort({ createdAt: -1 });
		await res.status(200).json(notes);
	} catch (err) {
		console.log("Error in the getNotes controller!", err.message);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const createNote = async (req, res) => {
	const { title, description } = req.body;

	try {
		const newNote = new Note({ title, description });
		await newNote.save();
		res.status(201).json(newNote);
	} catch (err) {
		console.log("Error in the createNote controller!", err.message);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const updateNote = async (req, res) => {
	const { id } = req.params;
	const { title, description } = req.body;

	try {
		const updatedNote = await Note.findByIdAndUpdate(
			id,
			{
				title,
				description,
			},
			{ new: true },
		);

		if (!updatedNote) {
			return res.status(404).json({ message: "Note not found!" });
		}

		res.status(200).json(updatedNote);
	} catch (err) {
		console.log("Error in the updateNote controller!", err.message);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const deleteNote = async (req, res) => {
	const { id } = req.params;

	try {
		const deletedNote = await Note.findByIdAndDelete(id);

		if (!deletedNote) {
			return res.status(404).json({ message: "Note not found!" });
		}

		res.status(200).json({ message: "Note deleted successfully!" });
	} catch (err) {
		console.log("Error in the deleteNote controller!", err.message);
		res.status(500).json({ message: "Internal server error!" });
	}
};
