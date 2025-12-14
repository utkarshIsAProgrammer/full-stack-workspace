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
