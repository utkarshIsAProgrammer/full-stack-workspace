import express from "express";
import "dotenv/config";
import { connectDB } from "./db/db.js";
import userRoutes from "./routes/user.routes.js";
import helmet from "helmet";
import { limiter } from "./middlewares/rateLimit.middleware.js";
import cookieParser from "cookie-parser";

const app = express();
const port = process.env.PORT || 5500;

app.use(express.json()); // allow json data in body
app.use(helmet()); // security headers
app.use(limiter); // rate limiter
app.use(cookieParser()); // parse cookies
app.use("/auth", userRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Taskmanager is live on http://localhost:${port}`);
	});
});
