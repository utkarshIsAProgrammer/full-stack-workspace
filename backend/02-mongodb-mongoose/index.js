import express from "express";
import connectDB from "./db/connectDB.js";
import {
	insertManyDocs,
	allDocs,
	singleDoc,
	updateDoc,
	updateDocs,
	deleteDoc,
	deleteByField,
	deleteManyByField,
} from "./models/Movies.js";

const app = express(); // initialize express
const port = process.env.PORT || 5500; // env server port
const DATABASE_URL = process.env.DATABASE_URL; // env mongoose url

connectDB(DATABASE_URL); // connect db

// insertManyDocs(); // creating the movie document
// allDocs(); // getting all documents
// singleDoc(); // getting document by id
// updateDoc("694c640d78c4b5bed16c73c3"); // update document by id
// updateDocs(); // update many documents by id
// deleteDoc(); // delete document by id
// deleteByField(); // delete document by field
deleteManyByField(); // delete many documents
// listening to the port
app.listen(port, () => {
	console.log(`Server started on PORT: ${port}`);
});
