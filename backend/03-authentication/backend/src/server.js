import express from "express";
import "dotenv/config";
import { connectDB } from "./config/db.js";
import { router as authRoutes } from "./routes/auth.routes.js";

const app = express();
const port = process.env.PORT || 5000;

app.use("/auth", authRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log("Server is running on port:", port);
	});
});
