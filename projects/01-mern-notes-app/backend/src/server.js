import express from "express";
import "dotenv/config";
import notesRoutes from "./routes/notesRoutes.js";
import connectDB from "./config/db.js";

const port = process.env.PORT || 5000; // .env --> port

const app = express();

connectDB(); // connect database

app.use(express.json());
app.use("/api/notes", notesRoutes); // using route

app.listen(port, () => {
	console.log(`Server running on PORT: ${port} `);
});
