import express from "express";
import "dotenv/config";
import noteRoutes from "./routes/noteRoutes.js";

const app = express();

app.listen(5000, () => {
	console.log("Server started on PORT: 5000");
});
