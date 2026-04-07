import express from "express";
import "dotenv/config";
import { connectDB } from "./db/db.js";
import productRoutes from "./routes/product.routes.js";
import { limiter } from "./middlewares/rateLimit.js";

const app = express();
const port = process.env.PORT;

app.use(express.json());
app.use(limiter);
app.use("/api", productRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Product Store is live on http://localhost:${port}`);
	});
});
