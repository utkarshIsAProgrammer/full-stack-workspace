import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connectDB } from "./db/db.js";
import { authRoutes } from "./routes/auth.routes.js";
import { expenseRoutes } from "./routes/expense.routes.js";

const app = express();
const port = process.env.PORT || 5500;

app.use(
	cors({
		origin: "http://127.0.0.1:3000",
		credentials: true,
	}),
);
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/tracker", expenseRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
