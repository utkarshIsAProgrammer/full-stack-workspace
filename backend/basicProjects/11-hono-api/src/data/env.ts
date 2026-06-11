import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
	PORT: z.coerce.number().int().positive().default(3000),
	DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required!"),
	DB_USER: z.string().min(1, "DB_USER is required!"),
	DB_NAME: z.string().min(1, "DB_NAME is required!"),
	DB_HOST: z.string().min(1, "DB_HOST is required!"),
	DB_PORT: z.coerce.number().int().positive().default(5432),
	JWT_SECRET: z.string().default("my-super-secret-key"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
	throw new Error(
		`Invalid environment variables: ${JSON.stringify(parsed.error.format())}`,
	);
}

export const env = parsed.data;
