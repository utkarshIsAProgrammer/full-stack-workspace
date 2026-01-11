import express from "express";
import "dotenv/config";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
// import blogRoutes from "./routes/blogRoutes.js";

const port = process.env.PORT || 5500;
const app = express();

app.use(express.json());
app.use("/user", userRoutes);
// app.use("/blog", blogRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server started on port: ${port}`);
	});
});
