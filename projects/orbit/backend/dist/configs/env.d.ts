import { z } from "zod";
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        development: "development";
        production: "production";
        test: "test";
    }>>>;
    PORT: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    MONGO_URI: z.ZodString;
    JWT_SECRET: z.ZodString;
    UPSTASH_REDIS_REST_URL: z.ZodURL;
    UPSTASH_REDIS_REST_TOKEN: z.ZodString;
    CLOUDINARY_NAME: z.ZodString;
    CLOUDINARY_API_KEY: z.ZodString;
    CLOUDINARY_API_SECRET: z.ZodString;
    SMTP_HOST: z.ZodString;
    SMTP_USER: z.ZodString;
    SMTP_PASS: z.ZodString;
    CLIENT_URL: z.ZodURL;
}, z.core.$strip>;
export type Env = z.infer<typeof envSchema>;
export declare const validateEnv: () => Env;
export {};
//# sourceMappingURL=env.d.ts.map