import mongoose from "mongoose";

const userInviteSchema = new mongoose.Schema(
  {
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invitedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null until someone uses the invite link
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending",
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userInviteSchema.index({ inviteCode: 1 });
userInviteSchema.index({ inviter: 1, status: 1 });

const UserInvite = mongoose.model("UserInvite", userInviteSchema);
export default UserInvite;
