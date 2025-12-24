const homeController = (req, res) => {
	const data = {
		name: "IndieDev",
		userId: 10,
	};

	res.render("index", data);
};

export default homeController;
