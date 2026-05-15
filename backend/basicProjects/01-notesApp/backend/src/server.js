import express from "express";
import "dotenv/config";
import noteRoutes from "./routes/noteRoutes.js";
import { connectDB } from "./db/db.js";
import { rateLimiter } from "./middleware/rateLimit.js";

const port = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use(rateLimiter);
app.use("/api", noteRoutes);

connectDB().then(
	app.listen(port, () => {
		console.log("Server started on PORT:", port);
	}),
);
