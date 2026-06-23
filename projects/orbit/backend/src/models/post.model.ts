import mongoose from "mongoose";
import slugify from "slugify";

// post schema
const postSchema = new mongoose.Schema(
  {
    // post title
    title: {
      type: String,
      default: "",
      maxlength: [500, "Title must be less than 500 characters!"],
    },

    // post slug
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    // post content
    content: {
      type: String,
      default: "",
      maxlength: [5000, "Content must be less than 5000 characters!"],
    },

    // hashtags
    hashtags: {
      type: [String],
      default: [],
      validate: {
        validator: function(v: string[]) {
          return v.length <= 10;
        },
        message: "Maximum 10 hashtags allowed!",
      },
    },

    // post image (single, kept for backward compat)
    image: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },

    // multiple images support (new)
    images: {
      type: [{
        url: { type: String, required: true },
        public_id: { type: String, default: "" },
        alt: { type: String, default: "" },
      }],
      default: [],
      validate: {
        validator: function(v: any[]) { return v.length <= 10; },
        message: "Maximum 10 images allowed!",
      },
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

// combined indexes for optimal query performance
postSchema.index({ title: "text", content: "text" });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ hashtags: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ "images.public_id": 1 });
postSchema.index({ slug: 1 }, { unique: true });
postSchema.index({ author: 1, pinned: -1, createdAt: -1 });
postSchema.index({ likesCount: -1 });
postSchema.index({ savesCount: -1 });
postSchema.index({ repostsCount: -1 });
postSchema.index({ viewsCount: -1 });
postSchema.index({ author: 1, createdAt: -1, _id: -1 });

// slug generation
postSchema.pre("validate", async function () {
  if (!this.isModified("title")) return;

  const title = this.title?.trim();
  const baseSlug = title
    ? slugify(title, { lower: true, strict: true })
    : `post-${Date.now()}`;
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
