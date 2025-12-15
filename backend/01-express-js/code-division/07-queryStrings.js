// query string...
app.get("/product", (req, res) => {
	const { category, id } = req.query;
	res.send(`Product Category: ${category} & Product ID: ${id}`);
});
