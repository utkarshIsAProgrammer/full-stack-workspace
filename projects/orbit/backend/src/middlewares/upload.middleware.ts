import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../configs/cloudinary";

// cloudinary storage config
const storage = new CloudinaryStorage({
  cloudinary,
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
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: any,
) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only image files allowed!"), false);
  }

  cb(null, true);
};

// multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export default upload;
