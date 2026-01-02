import express from "express";
import "dotenv/config";
import connectDB from "./config/db.js";
import productsRoutes from "./routes/prodcuctsRoute.js";
import rateLimiter from "./middleware/rateLimiter.js";

const app = express(); // express instance
const port = process.env.PORT || 5500; // port

// middlewares
app.use(express.json()); // allow json object in body
app.use(rateLimiter); // set rate limit
app.use("/store/", productsRoutes); // use routes

// connect to db and listen to the port
connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on port ${port}`);
	});
});
