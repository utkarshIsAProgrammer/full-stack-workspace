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

    // folder/category for organizing saves
    folder: {
      type: String,
      default: "General",
      maxlength: [50, "Folder name must be less than 50 characters!"],
      trim: true,
    },

    // note on the saved post
    note: {
      type: String,
      default: "",
      maxlength: [200, "Note must be less than 200 characters!"],
    },
  },

  { timestamps: true },
);

// unique save index
saveSchema.index({ user: 1, post: 1 }, { unique: true });
saveSchema.index({ user: 1, folder: 1 });
saveSchema.index({ user: 1, createdAt: -1 });
saveSchema.index({ post: 1, createdAt: -1 });

// save model
const Save = mongoose.model("Save", saveSchema);
export default Save;
