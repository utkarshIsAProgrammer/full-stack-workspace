import express from "express";
import {
	getAllStudents,
	addNewStudent,
	updateStudent,
	deleteStudent,
} from "../controllers/student.js";

const router = express.Router();

// routes
router.get("/all", getAllStudents);
router.post("/add", addNewStudent);
router.put("/update", updateStudent);
router.delete("/delete", deleteStudent);

export default router;
