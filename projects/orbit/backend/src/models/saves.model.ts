import mongoose from "mongoose";

// save schema
const saveSchema = new mongoose.Schema(
  {
    // user who saved
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // saved post
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
  },

  { timestamps: true },
);

// unique save index
saveSchema.index({ user: 1, post: 1 }, { unique: true });

// save model
const Save = mongoose.model("Save", saveSchema);
export default Save;
