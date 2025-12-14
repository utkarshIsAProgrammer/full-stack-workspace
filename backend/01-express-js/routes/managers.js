import express from "express";

const router = express.Router();

// routes
router.get("/get", (req, res) => {
	res.send("Get all managers!");
});

router.post("/add", (req, res) => {
	res.send("Add new manager!");
});

router.put("/update", (req, res) => {
	res.send("Update manager!");
});

router.delete("/delete", (req, res) => {
	res.send("Delete manager!");
});

export default router;
