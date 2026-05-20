"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
// cloudinary storage config
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.default,
    params: async (req, file) => ({
        folder: "orbit",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        public_id: `${Date.now()}-${file.originalname}`,
        transformation: [
            {
                width: 1200,
                crop: "limit",
                quality: "auto",
                fetch_format: "auto",
            },
        ],
    }),
});
// filter allowed types
const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
        return cb(new Error("Only image files allowed!"), false);
    }
    cb(null, true);
};
// multer instance
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
});
exports.default = upload;
//# sourceMappingURL=upload.middleware.js.map