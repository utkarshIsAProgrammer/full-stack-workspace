// middleware...
app.get("/", (req, res) => {
	res.send("<h1>Hello Admin!<h1/>");
});

app.get("/about", (req, res) => {
	res.send("<h1>About Admin!<h1/>");
});

app.get("/contact", (req, res) => {
	res.send("<h1>Contact Admin!<h1/>");
});
