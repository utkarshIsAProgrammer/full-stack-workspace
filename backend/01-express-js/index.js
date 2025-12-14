import express from "express";

// instance of express...
const app = express();

// callbacks...
const callback1 = (req, res, next) => {
	console.log("Callback 1");
	next();
};

const callback2 = (req, res, next) => {
	console.log("Callback 2");
	next();
};

const callback3 = (req, res) => {
	console.log("Callback 3");
	res.send("<h1>Array of callbacks<h1/>");
};

// clear terminal...
console.clear();

// api endpoints (routing)...
// 1. get method
app.get("/", (req, res) => {
	res.send("<h1>Welcome to the home page!<h1/>");
});

app.get("/about", (req, res) => {
	res.send("<h1>Welcome to the about page!<h1/>");
});

app.get("/contact", (req, res) => {
	res.send("<h1>Welcome to the contact page!<h1/>");
});

// REGEX...
app.get("/x/", (req, res) => {
	res.send("<h1>If the path includes x, this route will run.<h1/>");
});

// multiple callbacks ...
app.get(
	"/callback-craziness",
	(req, res, next) => {
		console.log("First callback!");
		// res.send("<h1>First callback!<h1/>");
		next();
	},
	(req, res) => {
		console.log("Second callback!");
		res.send("<h1>Second callback!<h1/>");
	}
);

// array of callbacks...
app.get("/callback-arrays", [callback1, callback2, callback3]);

// listen to the port...
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
