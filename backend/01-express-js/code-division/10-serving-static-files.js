// serving static files........
app.get("/", (req, res) => {
	res.sendFile(path.join(process.cwd(), "./public/index.html"));
});
