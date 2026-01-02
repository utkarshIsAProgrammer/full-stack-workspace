import express from "express";
import "dotenv/config";
import booksRoute from "./routes/booksRoute.js";
import connectDB from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

const port = process.env.PORT || 5500; // port
const app = express(); // express instance

// middlewares
app.use(express.json()); // parse json request bodies
app.use(rateLimiter);
app.use("/api/books", booksRoute);

// db connection and listening to the port
connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server started on port: ${port}`);
	});
});
