import mongoose from "mongoose";
import slugify from "slugify";

const postSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: [true, "title is required!"],
			minlength: [5, "Title must be at least 5 characters long!"],
			maxlength: [500, "Title must be less than 500 characters!"],
		},

		slug: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			index: true,
		},

		content: {
			type: String,
			required: true,
			minlength: [5, "Content must be at least 5 characters long!"],
			maxlength: [5000, "Content must be less than 5000 characters!"],
		},

		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
	},

	{ timestamps: true },
);

postSchema.index({ author: 1, published: 1, createdAt: -1 });

postSchema.pre("validate", async function () {
	if (!this.isModified("title")) return;

	const baseSlug = slugify(this.title, { lower: true, strict: true });
	let slug = baseSlug;
	let counter = 1;

	const Model = this.constructor as mongoose.Model<any>;

	while (
		await Model.findOne({
			slug,
			_id: { $ne: this._id },
		})
	) {
		slug = `${baseSlug}-${counter++}`;
	}

	this.slug = slug;
});

const Post = mongoose.model("Post", postSchema);
export default Post;
