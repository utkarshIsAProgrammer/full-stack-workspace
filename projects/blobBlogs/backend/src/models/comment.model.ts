import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
	{
		content: {
			type: String,
			required: [true, "Comment content is required!"],
			minlength: [1, "Comment must be at least 1 character long!"],
			maxlength: [1000, "Comment must be less than 1000 characters!"],
		},

		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		post: {
			type: String,
			ref: "Post",
			required: true,
		},

		parent: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Comment",
			default: null,
		},
	},
	{ timestamps: true },
);

commentSchema.index({ post: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
