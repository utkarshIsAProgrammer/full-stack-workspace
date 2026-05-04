/**
 * @file server.ts
 * @description Entry point for the blobBlogs backend application. Sets up Express server,
 * middlewares, routes, and connects to the database.
 */

import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { connectDB } from "./db/db";
import { authRoutes } from "./routes/auth.routes";
import { passwordRoutes } from "./routes/password.routes";
import { userRoutes } from "./routes/user.routes";
import { postRoutes } from "./routes/post.routes";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());

// Define API routes
app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/user", userRoutes);
app.use("/api/post", postRoutes);

// Initialize database connection before starting the server
connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
