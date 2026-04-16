import express from "express";

const app = express();
const port = 3000;

const router = express.Router();

app.use(express.json());

let cars = [
	{
		id: 1,
		name: "Toyota",
		model: "Camry",
		year: 2022,
		price: 28000,
	},

	{
		id: 2,
		name: "Tesla",
		model: "Model S",
		year: 2023,
		price: 25000,
	},

	{
		id: 3,
		name: "Ford",
		model: "F-150",
		year: 2021,
		price: 35000,
	},
];

router.get("/", (req, res) => {
	res.json(cars);
});

router.post("/", (req, res) => {
	const { name, model, year, price } = req.body;
	if (!name || !model || !year || !price) {
		return res.status(400).json({ error: "Missing fields!" });
	}

	const newCar = {
		id: cars.length + 1,
		name,
		model,
		year: Number(year),
		price: Number(price),
	};
	cars.push(newCar);

	res.status(201).json(newCar);
});

router.put("/:id", (req, res) => {
	const id = Number(req.params.id);
	const index = cars.findIndex((c) => c.id === id);
	if (index === -1) {
		return res.status(404).json({ error: "Car not found!" });
	} else {
		const { name, model, year, price } = req.body;
		if (name) cars[index].name = name;
		if (model) cars[index].model = model;
		if (year) cars[index].year = Number(year);
		if (price) cars[index].price = Number(price);

		res.json(cars[index]);
	}
});

router.delete("/:id", (req, res) => {
	const id = Number(req.params.id);
	const index = cars.findIndex((c) => c.id === id);
	if (index === -1) {
		return res.status(404).json({ error: "Car not found!" });
	} else {
		const deletedCar = cars.splice(index, 1)[0];
		res.json({ message: "Car deleted!", deletedCar });
	}
});

router.get("/:id", (req, res) => {
	const id = Number(req.params.id);
	const car = cars.find((car) => car.id === id);
	if (!car) {
		return res.status(404).json({ error: "Car not found!" });
	} else {
		res.json(car);
	}
});

app.use("/api/cars", router);

app.listen(port, () => {
	console.log(`Server is live at http://localhost:${port}`);
});
