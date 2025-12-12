import express from "express";

// instance of express
const app = express();

// api endpoints (routing)

// get method
app.get("/", (req, res) => {
	res.send("<h1>Welcome to the home page!<h1/>");
});

app.get("/about", (req, res) => {
	res.send("<h1>Welcome to the about page!<h1/>");
});

app.get("/contact", (req, res) => {
	res.send("<h1>Welcome to the contact page!<h1/>");
});

// listen to the port
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
