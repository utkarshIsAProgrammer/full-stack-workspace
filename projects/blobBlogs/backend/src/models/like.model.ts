import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
	{
		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		post: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Post",
			default: null,
		},

		comment: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Comment",
			default: null,
		},
	},
	{ timestamps: true },
);

likeSchema.index({ author: 1, post: 1 }, { unique: true });
likeSchema.index({ author: 1, comment: 1 }, { unique: true });

const Like = mongoose.model("Like", likeSchema);
export default Like;
