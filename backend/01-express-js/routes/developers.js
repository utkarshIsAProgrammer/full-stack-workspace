import express from "express";

const router = express.Router();

// routes
router.get("/get", (req, res) => {
	res.send("Get all developers!");
});

router.post("/add", (req, res) => {
	res.send("Add new developer!");
});

router.put("/update", (req, res) => {
	res.send("Update developer!");
});

router.delete("/delete", (req, res) => {
	res.send("Delete developer!");
});

export default router;
