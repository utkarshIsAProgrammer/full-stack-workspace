import mongoose from "mongoose";

// like schema
const likeSchema = new mongoose.Schema(
  {
    // like author
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // liked post
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    // liked comment
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
  },
  { timestamps: true },
);

// unique like indexes (only store document when post and comment exists)
likeSchema.index(
  { author: 1, post: 1 },
  {
    unique: true,
    partialFilterExpression: { post: { $ne: null } },
  },
);

likeSchema.index(
  { author: 1, comment: 1 },
  {
    unique: true,
    partialFilterExpression: { comment: { $ne: null } },
  },
);
// like model
const Like = mongoose.model("Like", likeSchema);
export default Like;
