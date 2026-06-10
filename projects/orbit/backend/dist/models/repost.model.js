"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// repost schema
const repostSchema = new mongoose_1.default.Schema({
    // user who reposted
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    // original post
    post: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true,
    },
}, { timestamps: true });
// unique repost index
repostSchema.index({ user: 1, post: 1 }, { unique: true });
repostSchema.index({ user: 1, createdAt: -1 });
repostSchema.index({ post: 1, createdAt: -1 });
// repost model
const Repost = mongoose_1.default.model("Repost", repostSchema);
exports.default = Repost;
//# sourceMappingURL=repost.model.js.map