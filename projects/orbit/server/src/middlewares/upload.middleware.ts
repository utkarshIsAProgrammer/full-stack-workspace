import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../configs/cloudinary";

// cloudinary storage config
// cloudinary storage config
const storage = new CloudinaryStorage({
  cloudinary,
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
const postImageStorage = new CloudinaryStorage({
  cloudinary,
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
const fileFilter = (
  req: any,
  file: any,
  cb: any,
) => {
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
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// multer instance for post images (multiple, smaller per-file limit)
const uploadPostImages = multer({
  storage: postImageStorage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB per image
    files: 10, // max 10 files
  },
});

// chat media storage (supports auto resource type for images and audio files)
const chatMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isAudio = file.mimetype.startsWith("audio/");
    return {
      folder: isAudio ? "orbit/chats/voice_notes" : "orbit/chats/media",
      resource_type: "auto",
      allowed_formats: undefined,
      public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
    };
  },
});

const chatFileFilter = (req: any, file: any, cb: any) => {
  cb(null, true);
};

const uploadChatMedia = multer({
  storage: chatMediaStorage,
  fileFilter: chatFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // max 5 files
  },
});

// ─── Post Media Storage (images + videos, 30MB) ─────────────────────
const postMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: "orbit/posts",
      resource_type: "auto",
      allowed_formats: isVideo
        ? ["mp4", "mov", "webm", "avi", "mkv", "3gp"]
        : ["jpg", "jpeg", "png", "webp", "gif"],
      public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
      // No transformations for video — Cloudinary auto-optimizes
      transformation: isVideo ? undefined : [
        {
          width: 800,
          height: 800,
          crop: "limit",
          quality: "auto",
          fetch_format: "auto",
        },
      ],
    };
  },
});

const postMediaFilter = (req: any, file: any, cb: any) => {
  const allowedImages = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  const allowedVideos = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/x-matroska", "video/3gpp"];
  const allAllowed = [...allowedImages, ...allowedVideos];

  if (!allAllowed.includes(file.mimetype)) {
    return cb(new Error("Only image and video files allowed!"), false);
  }

  cb(null, true);
};

const uploadPostMedia = multer({
  storage: postMediaStorage,
  fileFilter: postMediaFilter,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB per file
    files: 10, // max 10 files
  },
});

// ─── Glimpse Media Storage (images + videos) ────────────────────
const glimpseMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: "orbit/glances",
      resource_type: "auto",
      public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
      transformation: isVideo ? [{ width: 1080, crop: "limit", quality: "auto" }] : [
        { width: 1080, height: 1920, crop: "limit", quality: "auto", fetch_format: "auto" },
      ],
    };
  },
});

const glimpseMediaFilter = (req: any, file: any, cb: any) => {
  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");

  if (!isImage && !isVideo) {
    return cb(new Error("Only image and video files allowed for glances!"), false);
  }

  cb(null, true);
};

const uploadGlimpseMedia = multer({
  storage: glimpseMediaStorage,
  fileFilter: glimpseMediaFilter,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB per file
    files: 1,
  },
});

export { uploadPostImages, uploadChatMedia, uploadPostMedia, uploadGlimpseMedia };
export default upload;

