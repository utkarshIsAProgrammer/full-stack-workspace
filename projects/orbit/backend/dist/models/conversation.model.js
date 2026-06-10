"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conversation = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const conversationSchema = new mongoose_1.default.Schema({
    participants: {
        type: [
            {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        required: true,
        validate: {
            validator: function (val) {
                return val.length === 2;
            },
            message: "A 1-on-1 conversation must have exactly 2 participants!",
        },
    },
    lastMessage: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
    unreadCounts: {
        type: Map,
        of: Number,
        default: {},
    },
}, { timestamps: true });
// Indexes for optimal query performance
// Unique compound index on the sorted participants elements to enforce a single conversation between the same two users
// Note: To make this work correctly, participant IDs MUST be sorted alphabetically/lexicographically before saving.
conversationSchema.index({ "participants.0": 1, "participants.1": 1 }, { unique: true });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ lastMessage: 1 });
conversationSchema.index({ participants: 1, updatedAt: -1 });
exports.Conversation = mongoose_1.default.model("Conversation", conversationSchema);
//# sourceMappingURL=conversation.model.js.map