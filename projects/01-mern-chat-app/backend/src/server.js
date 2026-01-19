import express from "express";
import "dotenv/config";
import authRoutes from "./routes/auth.route.js";

const port = process.env.PORT || 3000;

const app = express();

app.use("/auth", authRoutes);

app.listen(port, () => {
	console.log("Server started on port:", port);
});
