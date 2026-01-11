import express from "express";
import {
	createUser,
	getUsers,
	getUserById,
} from "../controllers/userControllers.js";

const router = express.Router();

router.post("/create-user", createUser);
router.get("/get-all", getUsers);
router.get("/get-user/:id", getUserById);

export default router;
