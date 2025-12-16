import express from "express";
import developers from "./routes/developers.js";
import managers from "./routes/managers.js";
import students from "./routes/students.js";
import products from "./routes/products.js";
import userCredentials from "./middlewares/logs.js";
import path from "path";

// express instance...
const app = express();

// using routes...
app.use("/developers", developers);
app.use("/managers", managers);
app.use("/students", students);
app.use("/products", products);
app.use(userCredentials); // middleware function
app.use(express.static("./public"));

// listen to the port...
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
