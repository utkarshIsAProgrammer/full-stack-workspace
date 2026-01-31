import Product from "../models/product.model.js";
import mongoose from "mongoose";

export const getAllProducts = async (req, res) => {
	try {
		const products = await Product.find();
		res.status(200).json(products);
	} catch (err) {
		console.log("Error while fetching products!", err.message);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const createProduct = async (req, res) => {
	const product = req.body;
	if (!product.name || !product.price || !product.image) {
		return res.status(400).json({
			success: false,
			message: "Please provide all fields!",
		});
	}
	const newProduct = new Product(product);

	try {
		await newProduct.save();
		res.status(201).json(newProduct);
	} catch (err) {
		console.log("Error in the createProduct controller!", err.message);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const updateProduct = async (req, res) => {
	const { id } = req.params;
	const product = req.body;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res
			.status(404)
			.json({ success: false, message: "Invalid Product ID!" });
	}

	try {
		const updatedProduct = await Product.findByIdAndUpdate(id, product, {
			new: true,
		});
		res.status(200).json({ success: true, data: updatedProduct });
	} catch (err) {
		console.log(
			res
				.status(500)
				.json({ success: false, message: "Internal server error!" }),
		);
	}
};

export const deleteProduct = async (req, res) => {
	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res
			.status(404)
			.json({ success: false, message: "Invalid Product ID!" });
	}

	try {
		await Product.findById(id);
		res.status(200).json({ success: true, message: "Product deleted!" });
	} catch (err) {
		(console.log("Error in deleting product!"), err.message);
		res.status(500).json({ message: "Internal server error!" });
	}
};
