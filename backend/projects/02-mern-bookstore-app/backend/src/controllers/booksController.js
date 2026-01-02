import Book from "../models/Book.js";

// controllers
export async function getAllBooks(_, res) {
	try {
		const books = await Book.find().sort({ createdAt: -1 }); // createdAt: -1 sorts in descending order
		res.status(200).json(books);
	} catch (err) {
		console.log("Error in the getBook controller!", err);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function getBookById(req, res) {
	try {
		const book = await Book.findById(req.params.id);
		res.status(200).json(book);
	} catch (err) {
		console.log("Error in the getBookById controller!", err);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function addBook(req, res) {
	try {
		const { title, author, publishYear } = req.body;
		const newBook = new Book({ title, author, publishYear });
		const savedBook = await newBook.save();
		res.status(201).json(savedBook);
	} catch (err) {
		console.log("Error in the addBook controller!", err);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function updateBook(req, res) {
	try {
		const { title, author, publishYear } = req.body;
		const updatedBook = await Book.findByIdAndUpdate(req.params.id, {
			title,
			author,
			publishYear,
		});
		res.status(200).json(updatedBook);
	} catch (err) {
		console.log("Error in the updateBook controller!", err);
		res.status(500).json({ message: "Internal Server error!" });
	}
}

export async function deleteBook(req, res) {
	try {
		await Book.findByIdAndDelete(req.params.id);
		res.status(200).json({ message: "Book deleted successfully!" });
	} catch (err) {
		console.log("Error in the deleteBook controller!", err);
		res.status(500).json({ message: "Internal Server error!" });
	}
}
