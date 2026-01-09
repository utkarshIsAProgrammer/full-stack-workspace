import mongoose from "mongoose";

// schema
const blogSchema = new mongoose.Schema({
	title: {
		type: String,
		required: true,
	},

	content: {
		type: String,
		required: true,
	},

	author: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: "User",
	},
});

// model
const BlogModel = mongoose.model("Blog", blogSchema);

export default BlogModel;
