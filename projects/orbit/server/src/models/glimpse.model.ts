import mongoose from "mongoose";

const glimpseSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Media URL and Cloudinary public_id (supports both images and videos)
    media: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },

    // Type of media: "image" or "video"
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },

    viewers: {
      type: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          viewedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      validate: {
        validator: function (v: any[]) {
          return v.length <= 1;
        },
        message: "Maximum 1 viewer allowed!",
      },
    },

    maxViews: {
      type: Number,
      default: 1,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Virtual: how many views are remaining
glimpseSchema.virtual("viewsRemaining").get(function () {
  return Math.max(0, this.maxViews - this.viewers.length);
});

// Ensure virtuals are included in JSON/output
glimpseSchema.set("toJSON", { virtuals: true });
glimpseSchema.set("toObject", { virtuals: true });

// TTL index — MongoDB auto-deletes documents after expiresAt
glimpseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
glimpseSchema.index({ author: 1, createdAt: -1 });
glimpseSchema.index({ createdAt: -1 });

const Glimpse = mongoose.model("Glimpse", glimpseSchema);
export default Glimpse;
