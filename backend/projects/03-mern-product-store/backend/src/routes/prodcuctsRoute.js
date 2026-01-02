import express from "express";
import {
	getAllProducts,
	getProductById,
	addProduct,
	updateProduct,
	deleteProduct,
} from "../controllers/productsController.js";

const router = express.Router();

// routes
router.get("/get-all-products", getAllProducts);
router.get("/get-product-by-id/:id", getProductById);
router.post("/add-product", addProduct);
router.put("/update-product/:id", updateProduct);
router.delete("/delete-product/:id", deleteProduct);

export default router;
