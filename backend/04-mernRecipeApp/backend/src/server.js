import express from "express";
import "dotenv/config";
import { connectDB } from "./db/db.js";
import { userRouter } from "./routes/user.routes.js";

const app = express();
const port = process.env.PORT || 5500;

app.use(express.json());
app.use("/auth", userRouter);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});
