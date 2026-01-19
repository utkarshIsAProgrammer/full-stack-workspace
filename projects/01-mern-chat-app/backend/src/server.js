import express from "express";
import "dotenv/config";
import authRoutes from "./routes/auth.route.js";
import { connectDB } from "./libs/db.js";

const port = process.env.PORT || 3000;

const app = express();

app.use(express.json());
app.use("/auth", authRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log("Server started on port:", port);
	});
});
