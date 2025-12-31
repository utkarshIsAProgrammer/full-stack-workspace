import express from "express";
import "dotenv/config";
import notesRoutes from "./routes/notesRoutes.js";
import connectDB from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

const port = process.env.PORT || 5000; // .env --> port

const app = express();

app.use(express.json()); // middleware (this on allows access to the json request body)
app.use(rateLimiter); // middleware to ratelimit
app.use("/api/notes", notesRoutes); // using route

// connect databse first then listen to the port
connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server running on PORT: ${port}`);
	});
});
