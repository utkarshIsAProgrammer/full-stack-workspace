import express from "express";
import {
	getAllNotes,
	createNote,
	updateNote,
	deleteNote,
} from "../controllers/notesController.js";

const router = express.Router();

// routes
router.get("/get-note", getAllNotes);
router.post("/create-note", createNote);
router.put("/update-note/:id", updateNote);
router.delete("/delete-note/:id", deleteNote);

export default router;
