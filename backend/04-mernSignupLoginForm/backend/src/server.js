import express from "express";
import "dotenv/config";
import { connectDB } from "./db/db.js";
import { authRoutes } from "./routes/auth.routes.js";

const app = express();
const port = process.env.PORT || 5500;

app.use(express.json());
app.use("/api/auth", authRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Backend server is running on PORT:${port}`);
	});
});
