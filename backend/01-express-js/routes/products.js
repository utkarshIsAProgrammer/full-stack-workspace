import express from "express";

const router = express.Router();

//sending JSON...
router.get("/productsJSON", (req, res) => {
	res.json({ type: "Electronic Device", product: "Mobile Phone" });
});

export default router;
