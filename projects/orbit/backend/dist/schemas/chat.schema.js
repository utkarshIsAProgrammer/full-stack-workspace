"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.editMessageSchema = exports.sendMessageSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.sendMessageSchema = zod_1.default
    .object({
    text: zod_1.default.string().optional(),
    replyTo: zod_1.default.string().optional(),
    attachments: zod_1.default
        .array(zod_1.default.object({
        url: zod_1.default.string().url("Attachment URL must be valid"),
        public_id: zod_1.default.string().min(1, "Attachment public_id is required"),
        type: zod_1.default.enum(["image", "gif", "sticker", "meme", "voice_note"]),
    }))
        .optional(),
})
    .refine((data) => {
    const hasText = !!data.text && data.text.trim().length > 0;
    const hasAttachments = !!data.attachments && data.attachments.length > 0;
    return hasText || hasAttachments;
}, {
    message: "Message must contain either text or an attachment!",
    path: ["text"],
})
    .refine((data) => {
    if (data.text !== undefined && data.text.trim().length > 0) {
        const words = data.text.trim().split(/\s+/).filter(Boolean);
        return words.length >= 1;
    }
    return true;
}, {
    message: "Message must contain at least 1 word if text is provided!",
    path: ["text"],
});
exports.editMessageSchema = zod_1.default
    .object({
    text: zod_1.default.string().min(1, "Edited message text cannot be empty!"),
})
    .refine((data) => {
    const words = data.text.trim().split(/\s+/).filter(Boolean);
    return words.length >= 1;
}, {
    message: "Edited message must contain at least 1 word!",
    path: ["text"],
});
//# sourceMappingURL=chat.schema.js.map