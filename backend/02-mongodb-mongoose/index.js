import express from "express";
import connectDB from "./db/connectDB.js";

const app = express(); // initialize express
const port = process.env.PORT || 5500; // env server port
const DATABASE_URL = process.env.DATABASE_URL; // env mongoose url

connectDB(DATABASE_URL); // connect db

// listening to the port
app.listen(port, () => {
	console.log(`Server started on PORT: ${port}`);
});
