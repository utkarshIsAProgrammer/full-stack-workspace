"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const reactionSchema = new mongoose_1.default.Schema({
    emoji: {
        type: String,
        required: true,
    },
    sender: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});
const attachmentSchema = new mongoose_1.default.Schema({
    url: {
        type: String,
        required: true,
    },
    public_id: {
        type: String,
        default: "",
    },
    type: {
        type: String,
        enum: ["image", "gif", "sticker", "meme", "voice_note"],
        required: true,
    },
});
const messageSchema = new mongoose_1.default.Schema({
    conversation: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true,
    },
    sender: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    recipient: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    text: {
        type: String,
        default: "",
        trim: true,
    },
    attachments: {
        type: [attachmentSchema],
        default: [],
    },
    reactions: {
        type: [reactionSchema],
        default: [],
    },
    seen: {
        type: Boolean,
        default: false,
    },
    seenAt: {
        type: Date,
        default: null,
    },
    isEdited: {
        type: Boolean,
        default: false,
    },
    replyTo: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedFor: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: "User",
        }],
}, { timestamps: true });
// Index for replyTo lookups
messageSchema.index({ replyTo: 1 });
// Indexes for optimal query performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, isDeleted: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });
exports.Message = mongoose_1.default.model("Message", messageSchema);
//# sourceMappingURL=message.model.js.map