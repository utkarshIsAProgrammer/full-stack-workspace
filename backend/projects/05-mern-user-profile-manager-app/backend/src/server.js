import express from "express";
import "dotenv/config";
import connectDB from "./config/db.js";

const app = express();

const port = process.env.PORT || 5000;

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server started on port: ${port}`);
	});
});
