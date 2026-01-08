import express from "express";
import {
	getAllNotes,
	getNoteById,
	createNote,
	updateNote,
	adminDeleteNote,
	adminDeleteNotes,
	userDeleteNote,
	userDeleteNotes,
	viewDeletedNotes,
	restoreNote,
	restoreNotes,
} from "../controllers/notesController.js";

const router = express.Router();

// routes
router.get("/get-notes", getAllNotes);
router.get("/get-note-by-id/:id", getNoteById);

router.get("/view-deleted-notes", viewDeletedNotes);
router.post("/restore-notes", restoreNotes);
router.post("/restore-note/:id", restoreNote);

router.post("/create-note", createNote);
router.put("/update-note/:id", updateNote);

router.delete("/admin-delete-notes", adminDeleteNotes);
router.delete("/admin-delete-note/:id", adminDeleteNote);
router.delete("/user-delete-notes", userDeleteNotes);
router.delete("/user-delete-note/:id", userDeleteNote);

export default router;
