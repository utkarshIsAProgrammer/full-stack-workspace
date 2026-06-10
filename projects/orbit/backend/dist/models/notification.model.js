"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const notificationSchema = new mongoose_1.default.Schema({
    recipient: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    sender: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ["like", "comment", "follow", "repost", "save", "mention", "reaction"],
        required: true,
    },
    post: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Post",
        default: null,
    },
    comment: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Compound index for fetching unread notifications (common query pattern)
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
const Notification = mongoose_1.default.model("Notification", notificationSchema);
exports.default = Notification;
//# sourceMappingURL=notification.model.js.map