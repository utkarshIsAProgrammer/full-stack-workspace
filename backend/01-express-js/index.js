import express from "express";
import developers from "./routes/developers.js";
import managers from "./routes/managers.js";
import students from "./routes/students.js";

// express instance...
const app = express();

// using routes...
app.use("/developers", developers);
app.use("/managers", managers);
app.use("/students", students);

// query string...
app.get("/product", (req, res) => {
	const { category, id } = req.query;
	res.send(`Product Category: ${category} & Product ID: ${id}`);
});

// listen to the port...
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
