import express from "express";
import "dotenv/config";
import { connectDB } from "./libs/db.js";
import authRoutes from "./routes/auth.route.js";

const port = process.env.PORT || 5500; // port
const app = express(); // express instance

// middlewares
app.use(express.json());
app.use("/auth", authRoutes);

// connect db and listen to the port
connectDB().then(() => {
	app.listen(port, () => [console.log("Server started on PORT:", port)]);
});
