import express from "express";
import "dotenv/config";
import { connectDB } from "./libs/db.js";
import { authRoutes } from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";

const app = express();
const port = 5500;

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
