"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
// comment schema
const commentSchema = new mongoose_1.default.Schema({
    // comment content
    content: {
        type: String,
        required: [true, "Comment content is required!"],
        minlength: [1, "Comment must be at least 1 character long!"],
        maxlength: [1000, "Comment must be less than 1000 characters!"],
    },
    // comment author
    author: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // related post
    post: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
    },
    // parent for replies
    parent: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
    },
    // likes count
    likesCount: {
        type: Number,
        default: 0,
    },
    // replies count
    repliesCount: {
        type: Number,
        default: 0,
    },
    // whether comment has been edited
    isEdited: {
        type: Boolean,
        default: false,
    },
    // emoji reactions
    reactions: {
        type: [reactionSchema],
        default: [],
    },
}, { timestamps: true });
// post index
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ parent: 1 });
// comment model
const Comment = mongoose_1.default.model("Comment", commentSchema);
exports.default = Comment;
//# sourceMappingURL=comment.model.js.map