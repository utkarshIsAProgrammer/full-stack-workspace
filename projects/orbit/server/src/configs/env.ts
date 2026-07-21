import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),
  PORT: z.coerce.number().int().positive().optional().default(5002),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  UPSTASH_REDIS_REST_URL: z.string().optional().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(""),
  UPSTASH_REDIS_URL: z
    .string()
    .optional(),
  CLOUDINARY_NAME: z.string().min(1, "CLOUDINARY_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  CLIENT_URL: z.url("CLIENT_URL must be a valid URL"),

  // Web Push VAPID keys for push notifications (optional — push works without them)
  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().optional().default("mailto:orbit@example.com"),

  // ImageKit Configuration
  IMAGEKIT_PUBLIC_KEY: z.string().optional().default(""),
  IMAGEKIT_PRIVATE_KEY: z.string().optional().default(""),
  IMAGEKIT_URL_ENDPOINT: z.string().optional().default("https://ik.imagekit.io/orbitinnercircle/"),

  // Sentry Monitoring
  SENTRY_DSN: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (): Env => {
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

export const env = validateEnv();
