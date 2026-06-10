"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addViewSchema = exports.updatePostSchema = exports.toggleFollowSchema = exports.toggleRepostSchema = exports.updateSaveFolderSchema = exports.toggleSaveSchema = exports.toggleCommentLikeSchema = exports.toggleLikeSchema = void 0;
const zod_1 = require("zod");
// ---------- Like ----------
exports.toggleLikeSchema = zod_1.z.object({
    postId: zod_1.z.string().min(1, "Post ID is required"),
});
exports.toggleCommentLikeSchema = zod_1.z.object({
    commentId: zod_1.z.string().min(1, "Comment ID is required"),
});
// ---------- Saves ----------
exports.toggleSaveSchema = zod_1.z.object({
    folder: zod_1.z.string().max(50, "Folder name must be under 50 characters").optional(),
});
exports.updateSaveFolderSchema = zod_1.z.object({
    folder: zod_1.z.string().min(1, "Folder name is required").max(50, "Folder name must be under 50 characters"),
});
// ---------- Repost ----------
exports.toggleRepostSchema = zod_1.z.object({
    postId: zod_1.z.string().min(1, "Post ID is required"),
});
// ---------- Follow ----------
exports.toggleFollowSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
});
// ---------- Post update ----------
exports.updatePostSchema = zod_1.z.object({
    title: zod_1.z
        .string()
        .min(5, "Title must be at least 5 characters")
        .max(500, "Title must be under 500 characters")
        .optional(),
    content: zod_1.z
        .string()
        .min(5, "Content must be at least 5 characters")
        .max(5000, "Content must be under 5000 characters")
        .optional(),
}).refine((data) => data.title !== undefined || data.content !== undefined, { message: "At least one of title or content must be provided" });
// ---------- View ----------
exports.addViewSchema = zod_1.z.object({
    postId: zod_1.z.string().min(1, "Post ID is required"),
});
//# sourceMappingURL=interaction.schema.js.map