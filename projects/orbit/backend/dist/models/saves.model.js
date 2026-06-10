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
    // folder/category for organizing saves
    folder: {
        type: String,
        default: "General",
        maxlength: [50, "Folder name must be less than 50 characters!"],
        trim: true,
    },
    // note on the saved post
    note: {
        type: String,
        default: "",
        maxlength: [200, "Note must be less than 200 characters!"],
    },
}, { timestamps: true });
// unique save index
saveSchema.index({ user: 1, post: 1 }, { unique: true });
saveSchema.index({ user: 1, folder: 1 });
saveSchema.index({ user: 1, createdAt: -1 });
saveSchema.index({ post: 1, createdAt: -1 });
// save model
const Save = mongoose_1.default.model("Save", saveSchema);
exports.default = Save;
//# sourceMappingURL=saves.model.js.map