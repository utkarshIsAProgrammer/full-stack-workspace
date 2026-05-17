"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// save schema
const saveSchema = new mongoose_1.default.Schema({
    // user who saved
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    // saved post
    post: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true,
    },
}, { timestamps: true });
// unique save index
saveSchema.index({ user: 1, post: 1 }, { unique: true });
// save model
const Save = mongoose_1.default.model("Save", saveSchema);
exports.default = Save;
//# sourceMappingURL=saves.model.js.map