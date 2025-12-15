import express from "express";
import developers from "./routes/developers.js";
import managers from "./routes/managers.js";

// instance of express...
const app = express();

// using routes
app.use("/developers", developers);
app.use("/managers", managers);

// ------------------------------------------------------

// route parameters...
app.get("/product/:category/:id", (req, res) => {
	const { category, id } = req.params;
	console.log(category, id);
	res.send(`Product Category: ${category} & Product ID: ${id}`);
});

// ------------------------------------------------------

// listen to the port...
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
