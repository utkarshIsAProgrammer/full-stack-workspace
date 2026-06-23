"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePostSchema = exports.createPostSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.createPostSchema = zod_1.default.object({
    title: zod_1.default
        .string()
        .max(500, "Title must be less than 500 characters!")
        .optional()
        .default(""),
    content: zod_1.default
        .string()
        .max(5000, "Content must be less than 5000 characters!")
        .optional()
        .default(""),
    image: zod_1.default.string().optional(),
});
exports.updatePostSchema = zod_1.default
    .object({
    title: zod_1.default
        .string()
        .max(500, "Title must be less than 500 characters!")
        .optional(),
    content: zod_1.default
        .string()
        .max(5000, "Content must be less than 5000 characters!")
        .optional(),
    image: zod_1.default.string().optional(),
})
    .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: "At least one of title or content must be provided!",
    path: ["title"],
});
//# sourceMappingURL=post.schema.js.map