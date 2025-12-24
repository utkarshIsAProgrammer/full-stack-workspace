import express from "express";
import connectDB from "./db/connectDB.js";
import { insertManyDocs } from "./models/Movies.js";

const app = express(); // initialize express
const port = process.env.PORT || 5500; // env server port
const DATABASE_URL = process.env.DATABASE_URL; // env mongoose url

connectDB(DATABASE_URL); // connect db

insertManyDocs(); // creating the movie document

// listening to the port
app.listen(port, () => {
	console.log(`Server started on PORT: ${port}`);
});
