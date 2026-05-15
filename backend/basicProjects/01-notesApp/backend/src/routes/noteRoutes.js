import express from "express";
import {
	getNote,
	getNotes,
	createNote,
	updateNote,
	deleteNote,
} from "../controllers/noteControllers.js";

const router = express.Router();

router.get("/:id", getNote);
router.get("/", getNotes);
router.post("/", createNote);
router.put("/:id", updateNote);
router.delete("/:id", deleteNote);

export default router;
