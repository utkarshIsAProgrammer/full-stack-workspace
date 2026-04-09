import { z } from "zod";

export const registerSchema = z.object({
	name: z.string().min(3).max(30),
	email: z.email(),
	password: z.string().min(6),
});

export type RegisterInput = z.infer<typeof registerSchema>;
