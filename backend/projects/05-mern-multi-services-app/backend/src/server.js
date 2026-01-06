import express from "express";
import "dotenv/config";
import connectDB from "./config/db.js";
import taskmgrRoutes from "./routes/taskmgrRoutes.js";

const port = process.env.PORT;
const app = express();

app.use(express.json());
app.use("/services", taskmgrRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server started on port: ${port}`);
	});
});
