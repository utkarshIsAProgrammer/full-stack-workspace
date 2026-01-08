import express from "express";
import "dotenv/config";
import connectDB from "./config/db.js";
import taskmgrRoutes from "./routes/taskmgrRoutes.js";
import rateLimiter from "./middlewares/rateLimiter.js";

const port = process.env.PORT; // port
const app = express(); // express instance

// middlewares
app.use(express.json());
app.use(rateLimiter);
app.use("/services", taskmgrRoutes);

// connect db and listen to the port
connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server started on port: ${port}`);
	});
});
