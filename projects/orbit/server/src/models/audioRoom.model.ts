import mongoose from "mongoose";

const audioRoomSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Room title is required!"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters!"],
    },
    description: {
      type: String,
      default: "",
      maxlength: [500, "Description cannot exceed 500 characters!"],
    },
    speakers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    listeners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isLive: {
      type: Boolean,
      default: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    // Whether the room is being recorded (host option)
    isRecording: {
      type: Boolean,
      default: false,
    },
    // Max listeners (0 = unlimited)
    maxListeners: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

audioRoomSchema.index({ isLive: 1, startedAt: -1 });
audioRoomSchema.index({ host: 1, isLive: 1 });

const AudioRoom = mongoose.model("AudioRoom", audioRoomSchema);
export default AudioRoom;
