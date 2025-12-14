import express from "express";

// instance of express...
const app = express();

// clear terminal...
console.clear();

// listen to the port...
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
