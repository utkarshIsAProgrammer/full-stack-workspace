import express from "express";
import "dotenv/config";
import connectDB from "./config/db.js";
import taskRoutes from "./routes/tasksRoute.js";

const port = process.env.PORT || 5000; // port
const app = express(); // express instance

// middlewares
app.use(express.json());
app.use("/taskmanager", taskRoutes);

// connect db and listen
connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on port ${port}!`);
	});
});
