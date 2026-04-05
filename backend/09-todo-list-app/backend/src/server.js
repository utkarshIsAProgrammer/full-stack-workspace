import express from "express";
import "dotenv/config";
import cors from "cors";
import { connectDB } from "./db/db.js";
import { taskRoutes } from "./routes/task.routes.js";

const app = express();
const port = process.env.PORT || 5500;

app.use(express.json());
app.use(cors());
app.use("/api/tasks", taskRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
