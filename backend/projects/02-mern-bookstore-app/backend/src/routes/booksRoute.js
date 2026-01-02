import express from "express";
import {
	getAllBooks,
	getBookById,
	addBook,
	updateBook,
	deleteBook,
} from "../controllers/booksController.js";

const router = express.Router();

// routes
router.get("/get-all-books", getAllBooks);
router.get("/get-book-by-id/:id", getBookById);
router.post("/add-book", addBook);
router.put("/update-book/:id", updateBook);
router.delete("/delete-book/:id", deleteBook);

export default router;
