import mongoose from "mongoose";

// repost schema
const repostSchema = new mongoose.Schema(
  {
    // user who reposted
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // original post
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// unique repost index
repostSchema.index({ user: 1, post: 1 }, { unique: true });
repostSchema.index({ user: 1, createdAt: -1 });
repostSchema.index({ post: 1, createdAt: -1 });

// repost model
const Repost = mongoose.model("Repost", repostSchema);
export default Repost;
