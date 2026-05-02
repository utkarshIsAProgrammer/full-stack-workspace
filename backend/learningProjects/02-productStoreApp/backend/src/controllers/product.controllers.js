import Product from "../models/product.model.js";

export const getProduct = async (req, res) => {
	const { id } = req.params;

	try {
		const product = await Product.findById(id);

		if (!product) {
			return res.status(404).json({ message: "Product not found!" });
		}

		res.status(200).json(product);
	} catch (err) {
		console.log(`Error in the getProduct controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const getProducts = async (_, res) => {
	try {
		const products = await Product.find();

		if (!products) {
			return res.status(404).json({ message: "Products not found!" });
		}

		res.status(200).json(products);
	} catch (err) {
		console.log(`Error in the getProducts controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const addProduct = async (req, res) => {
	// const { image, title, description, price } = req.body;

	try {
		const newProduct = await Product.create(req.body);
		res.status(201).json(newProduct);
	} catch (err) {
		console.log(`Error in the addProduct controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const updateProduct = async (req, res) => {
	const { id } = req.params;

	try {
		const updatedProduct = await Product.findByIdAndUpdate(id, req.body, {
			new: true,
		});
		if (!updatedProduct) {
			return res.status(404).json({ message: "Product not found!" });
		}
		res.status(200).json(updatedProduct);
	} catch (err) {
		console.log(`Error in the updateProduct controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const deleteProduct = async (req, res) => {
	const { id } = req.params;

	try {
		const deletedProduct = await Product.findByIdAndDelete(id);
		if (!deletedProduct) {
			return res.status(404).json({ message: "Product not found!" });
		}
		res.status(200).json({ message: "Product Deleted Successfully!" });
	} catch (err) {
		console.log(`Error in the deleteProduct controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};
