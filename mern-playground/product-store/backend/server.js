import express from "express";
import "dotenv/config";
import { connectDB } from "./config/db.js";

const port = process.env.PORT || 5000;
const app = express();

app.get("/home", (req, res) => {
	res.send("Welcome to the homepage!");
});

connectDB().then(() => {
	app.listen(port, () => {
		console.log("Server started at PORT:", port);
	});
});
