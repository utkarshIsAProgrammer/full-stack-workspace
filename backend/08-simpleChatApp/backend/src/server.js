import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { connectDB } from "./db/db.js";
import { authRoutes } from "./routes/auth.routes.js";
import { messageRoutes } from "./routes/message.routes.js";

const app = express();
const port = process.env.PORT || 5500;

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
