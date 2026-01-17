import express from "express";
import "dotenv/config";

const port = process.env.PORT || 3000;
const app = express();

app.listen(3000, () => {
	console.log("Server started on port:", 3000);
});
