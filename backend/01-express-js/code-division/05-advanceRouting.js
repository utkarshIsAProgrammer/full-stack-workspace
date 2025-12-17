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
