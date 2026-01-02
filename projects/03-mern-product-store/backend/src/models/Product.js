import mongoose from "mongoose";

// schema
const productSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},
		price: {
			type: Number,
			required: true,
		},
		imageUrl: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true }
);

// model
const ProductModel = mongoose.model("Product", productSchema); // "Product" model/collection uses the "productSchema" as it's schema will be will shown as "products" when executed

export default ProductModel;
