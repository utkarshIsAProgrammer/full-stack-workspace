import express from "express";
import "dotenv/config";
import { connectDB } from "./db/db.js";
import userRoutes from "./routes/user.routes.js";

const app = express();
const port = process.env.PORT || 5500;

app.use(express.json());
app.use("/auth", userRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Taskmanager is live on http://localhost:${port}`);
	});
});
