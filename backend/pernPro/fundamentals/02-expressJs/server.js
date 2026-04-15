import express from "express";

const app = express();
const port = 3000;

const router = express.Router();

let cars = [
	{
		id: 1,
		name: "Toyota",
		model: "Camry",
		year: 2022,
		price: "$28000",
	},

	{
		id: 2,
		name: "Tesla",
		model: "Model S",
		year: 2023,
		price: "$25000",
	},

	{
		id: 3,
		name: "Ford",
		model: "F-150",
		year: 2021,
		price: "$35000",
	},
];

router.get("/", (req, res) => {
	res.send("Hello from the Cars API!");
});

router.get("/", (req, res) => {
	res.send("All cars");
});

router.post("/", (req, res) => {
	res.send("New car");
});

router.put("/:id", (req, res) => {
	req.send("Update car");
});

router.delete("/:id", (req, res) => {
	res.send("Delete car");
});

router.get("/:id", (req, res) => {
	res.send("Get car");
});

app.use("/api/cars", router);

app.listen(port, () => {
	console.log(`Server is live at http://localhost:${port}`);
});
