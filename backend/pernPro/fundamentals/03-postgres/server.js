import express from "express";
import { db } from "./db.js";
import { cars } from "./schema.js";
import { eq } from "drizzle-orm";

const app = express();
const port = 3000;
const router = express.Router();

app.use(express.json());
app.use((req, res, next) => {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] ${req.method} ${req.url}`);
	next();
});

router.get("/", async (req, res) => {
	try {
		const allCars = await db.select().from(cars);
		res.json(allCars);
	} catch (err) {
		res.status(500).json({
			error: "Failed to fetch cars",
			details: err.message,
		});
	}
});

router.get("/:id", async (req, res) => {
	try {
		const id = Number(req.params.id);
		const [car] = await db.select().from(cars).where(eq(cars.id, id));
		if (!car) return res.status(404).json({ error: "Car not found!" });
		res.json(car);
	} catch (err) {
		res.status(500).json({
			error: "Failed to fetch car",
			details: err.message,
		});
	}
});

router.post("/", async (req, res) => {
	try {
		const { make, model, year, price } = req.body;
		if (!make || !model || !year || !price) {
			return res.status(400).json({ error: "Missing required fields!" });
		}

		const [newCar] = await db
			.insert(cars)
			.values({ make, model, year: Number(year), price: Number(price) })
			.returning();

		res.status(201).json(newCar);
	} catch (err) {
		res.status(500).json({
			error: "Failed to create car",
			details: err.message,
		});
	}
});

router.put("/:id", async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { make, model, year, price } = req.body;

		const [existing] = await db.select().from(cars).where(eq(cars.id, id));
		if (!existing) return res.status(404).json({ error: "Car not found!" });

		const updates = {};
		if (make) updates.make = make;
		if (model) updates.model = model;
		if (year) updates.year = Number(year);
		if (price) updates.price = Number(price);

		const [updated] = await db
			.update(cars)
			.set(updates)
			.where(eq(cars.id, id))
			.returning();

		res.json(updated);
	} catch (err) {
		res.status(500).json({
			error: "Failed to update car",
			details: err.message,
		});
	}
});

router.delete("/:id", async (req, res) => {
	try {
		const id = Number(req.params.id);
		const [deleted] = await db
			.delete(cars)
			.where(eq(cars.id, id))
			.returning();

		if (!deleted) return res.status(404).json({ error: "Car not found!" });
		res.json({ message: "Car deleted!", deletedCar: deleted });
	} catch (err) {
		res.status(500).json({
			error: "Failed to delete car",
			details: err.message,
		});
	}
});

app.use("/api/cars", router);

app.listen(port, () => {
	console.log(`Server is live at http://localhost:${port}`);
});
