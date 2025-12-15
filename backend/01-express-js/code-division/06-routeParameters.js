// route parameters...
app.get("/product/:category/:id", (req, res) => {
	const { category, id } = req.params;
	console.log(category, id);
	res.send(`Product Category: ${category} & Product ID: ${id}`);
});
