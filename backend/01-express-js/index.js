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
	res.send("Array of callbacks");
};

// clear terminal...
console.clear();

// api endpoints (routing)...
// 1. get method
app.get("/", (req, res) => {
	res.send("Welcome to the home page!");
});

app.get("/about", (req, res) => {
	res.send("Welcome to the about page!");
});

app.get("/contact", (req, res) => {
	res.send("Welcome to the contact page!");
});

// REGEX...
app.get("/x/", (req, res) => {
	res.send("If the path includes x, this route will run.");
});

// multiple callbacks ...
app.get(
	"/callback-craziness",
	(req, res, next) => {
		console.log("First callback!");
		// res.send("First callback!");
		next();
	},
	(req, res) => {
		console.log("Second callback!");
		res.send("Second callback!");
	}
);

// array of callbacks...
app.get("/callback-arrays", [callback1, callback2, callback3]);

// HTTP methods ...
// refactored
app.route("/developers")
	.get((req, res) => {
		res.send("Get all developers!");
	})
	.post((req, res) => {
		res.send("All new developer!");
	})
	.put((req, res) => {
		res.send("Update developer!");
	})
	.delete((req, res) => {
		res.send("Delete developer!");
	});

// listen to the port...
app.listen("5000", () => {
	console.log("Server started on PORT: 5000");
});
