import mongoose from "mongoose";

// comment schema
const commentSchema = new mongoose.Schema(
  {
    // comment content
    content: {
      type: String,
      required: [true, "Comment content is required!"],
      minlength: [1, "Comment must be at least 1 character long!"],
      maxlength: [1000, "Comment must be less than 1000 characters!"],
    },

    // comment author
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // related post
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    // parent for replies
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    // likes count
    likesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// post index
commentSchema.index({ post: 1, createdAt: -1 });

// comment model
const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
