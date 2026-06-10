"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const slugify_1 = __importDefault(require("slugify"));
// post schema
const postSchema = new mongoose_1.default.Schema({
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
    },
    // post content
    content: {
        type: String,
        required: true,
        minlength: [5, "Content must be at least 5 characters long!"],
        maxlength: [5000, "Content must be less than 5000 characters!"],
    },
    // hashtags
    hashtags: {
        type: [String],
        default: [],
        validate: {
            validator: function (v) {
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
            validator: function (v) { return v.length <= 10; },
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
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
}, { timestamps: true });
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
    if (!this.isModified("title"))
        return;
    const baseSlug = (0, slugify_1.default)(this.title, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    const Model = this.constructor;
    while (await Model.findOne({
        slug,
        _id: { $ne: this._id },
    })) {
        slug = `${baseSlug}-${counter++}`;
    }
    this.slug = slug;
});
// post model
const Post = mongoose_1.default.model("Post", postSchema);
exports.default = Post;
//# sourceMappingURL=post.model.js.map