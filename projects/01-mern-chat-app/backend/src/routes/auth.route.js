import express from "express";

const router = express.Router();

router.get("/signup", (req, res) => {
	res.status(200).json({ message: "Signup successfully!" });
});

router.get("/login", (req, res) => {
	res.status(200).json({ message: "Login successfully!" });
});

router.get("/logout", (req, res) => {
	res.status(200).json({ message: "Logout successfully!" });
});

export default router;
