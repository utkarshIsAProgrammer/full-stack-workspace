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
