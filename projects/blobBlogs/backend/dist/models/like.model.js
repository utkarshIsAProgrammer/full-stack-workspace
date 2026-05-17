"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// like schema
const likeSchema = new mongoose_1.default.Schema({
    // like author
    author: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // liked post
    post: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Post",
        default: null,
    },
    // liked comment
    comment: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
    },
}, { timestamps: true });
// unique like indexes (only store document when post and comment exists)
likeSchema.index({ author: 1, post: 1 }, {
    unique: true,
    partialFilterExpression: { post: { $exists: true } },
});
likeSchema.index({ author: 1, comment: 1 }, {
    unique: true,
    partialFilterExpression: { comment: { $exists: true } },
});
// like model
const Like = mongoose_1.default.model("Like", likeSchema);
exports.default = Like;
//# sourceMappingURL=like.model.js.map