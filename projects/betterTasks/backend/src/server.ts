import express from "express";
import "dotenv/config";
import { connectDB } from "./db/db";
import { taskRoutes } from "./routes/task.routes";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use("/api/tasks", taskRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
