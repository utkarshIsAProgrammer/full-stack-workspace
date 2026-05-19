import mongoose from "mongoose";
import slugify from "slugify";

// post schema
const postSchema = new mongoose.Schema(
  {
    // post title
    title: {
      type: String,
      required: [true, "title is required!"],
      minlength: [5, "Title must be at least 5 characters long!"],
      maxlength: [500, "Title must be less than 500 characters!"],
    },

    // post slug
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    // post content
    content: {
      type: String,
      required: true,
      minlength: [5, "Content must be at least 5 characters long!"],
      maxlength: [5000, "Content must be less than 5000 characters!"],
    },

    // post image
    image: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },

    // repost count
    repostsCount: {
      type: Number,
      default: 0,
    },

    // post saves
    savesCount: {
      type: Number,
      default: 0,
    },

    // post likes
    likesCount: {
      type: Number,
      default: 0,
    },

    // comment count
    commentsCount: {
      type: Number,
      default: 0,
    },

    // shares count
    sharesCount: {
      type: Number,
      default: 0,
    },

    // views count
    viewsCount: {
      type: Number,
      default: 0,
    },

    // post author
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },

  { timestamps: true },
);

// combined index
postSchema.index({ author: 1, createdAt: -1 });

// slug generation
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

// post model
const Post = mongoose.model("Post", postSchema);
export default Post;
