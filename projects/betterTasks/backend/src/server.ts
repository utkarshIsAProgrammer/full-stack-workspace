import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connectDB } from "./db/db";
import { taskRoutes } from "./routes/task.routes";
import { authRoutes } from "./routes/auth.routes";
import { rateLimiter } from "./middlewares/rateLimit.middleware";

const app = express();
const port = process.env.PORT || 5000;

app.use(
	cors({
		origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
		credentials: true,
	}),
);
app.use(express.json());
app.use(cookieParser());
app.use(rateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
