"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// url schema definition
const urlSchema = new mongoose_1.default.Schema({
    originalUrl: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, unique: true, index: true },
}, { timestamps: true });
// export model
exports.default = mongoose_1.default.model("Url", urlSchema);
//# sourceMappingURL=url.model.js.map