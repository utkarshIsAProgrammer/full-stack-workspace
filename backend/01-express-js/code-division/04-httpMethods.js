// HTTP methods...
app.get("/developers", (req, res) => {
	res.send("Get all developers!");
});

app.post("/developers", (req, res) => {
	res.send("All new developer!");
});

app.put("/developers", (req, res) => {
	res.send("Update developer!");
});

app.delete("/developers", (req, res) => {
	res.send("Delete developer!");
});
