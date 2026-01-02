import mongoose from "mongoose";
import Product from "../models/Product.js";

// controllers
export async function getAllProducts(_, res) {
	try {
		const products = await Product.find().sort({ createdAt: -1 });
		res.status(200).json(products);
	} catch (err) {
		console.log("Error in teh getAllProducts controller!", err.message);
		res.status(500).json({ message: "Internal server error!" });
	}
}

export async function getProductById(req, res) {
	try {
		const product = await Product.findById(req.params.id);
		res.status(200).json(product);
	} catch (err) {
		console.log("Error in the getProductById controller!", err.message);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
}

export async function addProduct(req, res) {
	const { title, price, imageUrl } = req.body;

	if (!title || !price || !imageUrl) {
		return res.status(400).json({ message: "Please provide all fields!" });
	}

	try {
		const newProduct = new Product({ title, price, imageUrl });
		const savedProduct = await newProduct.save();
		res.status(201).json(savedProduct);
	} catch (err) {
		console.log("Error in the addProduct controller!", err.message);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
}

export async function updateProduct(req, res) {
	const { title, price, imageUrl } = req.body;
	const id = req.params.id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(404).json({ message: "Invalid Product Id!" });
	}

	try {
		const updatedProduct = await Product.findByIdAndUpdate(id, {
			title,
			price,
			imageUrl,
		});
		res.status(200).json(updatedProduct);
	} catch (err) {
		console.log("Error in the updateProduct controller!", err.message);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
}

export async function deleteProduct(req, res) {
	const id = req.params.id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(404).json({ message: "Invalid Product Id!" });
	}

	try {
		await Product.findByIdAndDelete(id);
		res.status(200).json({ message: "Product deleted successfully!" });
	} catch (err) {
		console.log("Error in the deleteProduct controller!", err.message);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
}
