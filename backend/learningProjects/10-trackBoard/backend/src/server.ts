import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { connectDB } from "./db/db.js";
import { authRoutes } from "./routes/auth.routes.ts";
import { taskRoutes } from "./routes/task.routes.ts";

const app = express();
const port = process.env.PORT;

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
