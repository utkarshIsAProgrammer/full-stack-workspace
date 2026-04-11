import express from "express";
import "dotenv/config";
import { movieRoutes } from "./routes/movie.routes.js";
import { connectDB, disconnectDB } from "./db/db.js";

const app = express();
const port = process.env.PORT || 3000;

app.use("/api/movies", movieRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});

// Handle unhandled promise rejections (e.g., database connection errors)
process.on("unhandledRejection", (err) => {
	console.error("Unhandled Rejection:", err);
	server.close(async () => {
		await disconnectDB();
		process.exit(1);
	});
});

// Handle uncaught exceptions
process.on("uncaughtException", async (err) => {
	console.error("Uncaught Exception:", err);
	await disconnectDB();
	process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("SIGTERM received, shutting down gracefully");
	server.close(async () => {
		await disconnectDB();
		process.exit(0);
	});
});
