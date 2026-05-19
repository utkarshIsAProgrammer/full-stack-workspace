"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCommentSchema = exports.addCommentSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.addCommentSchema = zod_1.default.object({
    content: zod_1.default
        .string()
        .min(1, "Comment must be at least 1 character long!")
        .max(1000, "Comment must be less than 1000 characters!"),
    parent: zod_1.default.string().optional(),
});
exports.updateCommentSchema = exports.addCommentSchema;
//# sourceMappingURL=comment.schema.js.map