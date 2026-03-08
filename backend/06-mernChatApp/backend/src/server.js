import express from "express";
import "dotenv/config";
import { connectDB } from "./libs/db.js";

const app = express();
const port = process.env.PORT;

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
