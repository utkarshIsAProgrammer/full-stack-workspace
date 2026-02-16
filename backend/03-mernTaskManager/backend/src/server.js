import express from "express";
import "dotenv/config";
import { connectDB } from "./db/db.js";

const app = express();
const port = process.env.PORT || 5500;

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Taskmanager is live on http://localhost:${port}`);
	});
});
