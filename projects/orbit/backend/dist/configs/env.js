"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = exports.validateEnv = void 0;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum(["development", "production", "test"])
        .optional()
        .default("development"),
    PORT: zod_1.z.coerce.number().int().positive().optional().default(5002),
    MONGO_URI: zod_1.z.string().min(1, "MONGO_URI is required"),
    JWT_SECRET: zod_1.z.string().min(1, "JWT_SECRET is required"),
    UPSTASH_REDIS_REST_URL: zod_1.z.url("UPSTASH_REDIS_REST_URL must be a valid URL"),
    UPSTASH_REDIS_REST_TOKEN: zod_1.z
        .string()
        .min(1, "UPSTASH_REDIS_REST_TOKEN is required"),
    CLOUDINARY_NAME: zod_1.z.string().min(1, "CLOUDINARY_NAME is required"),
    CLOUDINARY_API_KEY: zod_1.z.string().min(1, "CLOUDINARY_API_KEY is required"),
    CLOUDINARY_API_SECRET: zod_1.z.string().min(1, "CLOUDINARY_API_SECRET is required"),
    SMTP_HOST: zod_1.z.string().min(1, "SMTP_HOST is required"),
    SMTP_USER: zod_1.z.string().min(1, "SMTP_USER is required"),
    SMTP_PASS: zod_1.z.string().min(1, "SMTP_PASS is required"),
    CLIENT_URL: zod_1.z.url("CLIENT_URL must be a valid URL"),
});
const validateEnv = () => {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        const formatted = result.error.flatten().fieldErrors;
        console.error("Invalid or missing environment variables:");
        for (const [key, messages] of Object.entries(formatted)) {
            console.error(`  ${key}: ${(messages ?? []).join(", ")}`);
        }
        process.exit(1);
    }
    return result.data;
};
exports.validateEnv = validateEnv;
exports.env = (0, exports.validateEnv)();
//# sourceMappingURL=env.js.map