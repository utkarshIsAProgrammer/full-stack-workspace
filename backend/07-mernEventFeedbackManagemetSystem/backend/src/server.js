import express from "express";
import "dotenv/config";
import { connectDB } from "./libs/db.js";
import { feedbackRoutes } from "./routes/feedback.routes.js";
import cors from "cors";

const app = express();
const port = process.env.PORT || 5500;

app.use(
	cors({
		origin: "https://event-feedback-system-three.vercel.app",
	}),
);
app.use(express.json());
app.use("/", feedbackRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
