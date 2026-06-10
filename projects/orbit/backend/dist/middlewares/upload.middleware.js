"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadChatMedia = exports.uploadPostImages = void 0;
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
// cloudinary storage config
// cloudinary storage config
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.default,
    params: async (req, file) => ({
        folder: "orbit",
        resource_type: "auto",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
        public_id: `${Date.now()}-${file.originalname}`,
        transformation: file.mimetype === "image/gif" ? undefined : [
            {
                width: 1200,
                crop: "limit",
                quality: "auto",
                fetch_format: "auto",
            },
        ],
    }),
});
// cloudinary storage config for post images (smaller)
const postImageStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.default,
    params: async (req, file) => ({
        folder: "orbit/posts",
        resource_type: "auto",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
        public_id: `${Date.now()}-${file.originalname}`,
        transformation: file.mimetype === "image/gif" ? undefined : [
            {
                width: 800,
                height: 800,
                crop: "limit",
                quality: "auto",
                fetch_format: "auto",
            },
        ],
    }),
});
// filter allowed types
const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
        return cb(new Error("Only image files allowed!"), false);
    }
    // Check file size before upload (additional security layer)
    if (file.size > 5 * 1024 * 1024) {
        return cb(new Error("File size exceeds 5MB limit!"), false);
    }
    cb(null, true);
};
// multer instance (profile/banner uploads)
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
});
// multer instance for post images (multiple, smaller per-file limit)
const uploadPostImages = (0, multer_1.default)({
    storage: postImageStorage,
    fileFilter,
    limits: {
        fileSize: 3 * 1024 * 1024, // 3MB per image
        files: 10, // max 10 files
    },
});
exports.uploadPostImages = uploadPostImages;
// chat media storage (supports auto resource type for images and audio files)
const chatMediaStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.default,
    params: async (req, file) => {
        const isAudio = file.mimetype.startsWith("audio/");
        return {
            folder: isAudio ? "orbit/chats/voice_notes" : "orbit/chats/media",
            resource_type: "auto",
            allowed_formats: isAudio
                ? ["mp3", "wav", "webm", "ogg", "m4a"]
                : ["jpg", "jpeg", "png", "webp", "gif"],
            public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
        };
    },
});
const chatFileFilter = (req, file, cb) => {
    const allowedImageMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
    ];
    const allowedAudioMimeTypes = [
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/webm",
        "audio/ogg",
        "audio/x-m4a",
        "audio/m4a",
        "audio/mp4",
        "audio/aac",
    ];
    if (allowedImageMimeTypes.includes(file.mimetype) ||
        allowedAudioMimeTypes.includes(file.mimetype)) {
        return cb(null, true);
    }
    cb(new Error("Only image and audio files are allowed in chat!"), false);
};
const uploadChatMedia = (0, multer_1.default)({
    storage: chatMediaStorage,
    fileFilter: chatFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5, // max 5 files
    },
});
exports.uploadChatMedia = uploadChatMedia;
exports.default = upload;
//# sourceMappingURL=upload.middleware.js.map