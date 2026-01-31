import express from "express";
import "dotenv/config";
import { connectDB } from "./config/db.js";
import productRoutes from "./routes/product.route.js";
import cors from "cors";

const port = process.env.PORT || 5000;
const app = express();

app.use(cors);
app.use(express.json());
app.use("/api/products", productRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log("Server started at PORT:", port);
	});
});
