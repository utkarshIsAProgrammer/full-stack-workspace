"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// follow schema
const followSchema = new mongoose_1.default.Schema({
    // user who follows
    follower: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // user being followed
    following: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, { timestamps: true });
// unique follow index
followSchema.index({ follower: 1, following: 1 }, { unique: true });
// follow model
const Follow = mongoose_1.default.model("Follow", followSchema);
exports.default = Follow;
//# sourceMappingURL=follow.model.js.map