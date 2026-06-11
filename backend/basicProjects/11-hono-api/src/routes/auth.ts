import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/db";
import { hashPassword, verifyPassword } from "../libs/crypto";
import { UserTable } from "../db/schema/users";
import { sign } from "hono/jwt";
import { setCookie, deleteCookie } from "hono/cookie";
import { env } from "../data/env";

const auth = new Hono();

const registerSchema = z.object({
	email: z.string().email("Invalid email format!"),
	password: z.string().min(8, "Password is required"),
});

const loginSchema = z.object({
	email: z.string().email("Invalid email format!"),
	password: z.string().min(1, "Password is required"),
});

// GET ALL USERS
auth.get("/", async (c) => {
	const users = await db.query.UserTable.findMany({
		columns: {
			id: true,
			email: true,
		},
	});
	return c.json(users);
});

// REGISTER/SIGNUP HANDLER
const registerHandler = async (c: any) => {
	const data = c.req.valid("json");

	// Check if user already exists
	const existingUser = await db.query.UserTable.findFirst({
		where: (table, { eq }) => eq(table.email, data.email),
	});

	if (existingUser) {
		return c.json({ error: "Email already registered" }, 400);
	}

	const hashedPassword = await hashPassword(data.password);

	await db.insert(UserTable).values({
		email: data.email,
		password: hashedPassword,
	});

	return c.json({ message: "User registered successfully" }, 201);
};

auth.post("/register", sValidator("json", registerSchema), registerHandler);
auth.post("/signup", sValidator("json", registerSchema), registerHandler);

// LOGIN
auth.post("/login", sValidator("json", loginSchema), async (c) => {
	const data = c.req.valid("json");

	const user = await db.query.UserTable.findFirst({
		where: (table, { eq }) => eq(table.email, data.email),
	});

	if (!user) {
		return c.json({ error: "Invalid email or password" }, 401);
	}

	const isValid = await verifyPassword(data.password, user.password);
	if (!isValid) {
		return c.json({ error: "Invalid email or password" }, 401);
	}

	// Generate a JWT Token
	const payload = {
		id: user.id,
		email: user.email,
		exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
	};
	const token = await sign(payload, env.JWT_SECRET);

	// Set HTTP-Only Cookie
	setCookie(c, "auth_token", token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "Strict",
		maxAge: 60 * 60 * 24,
		path: "/",
	});

	return c.json({ message: "Logged in successfully", token });
});

// LOGOUT
auth.post("/logout", async (c) => {
	deleteCookie(c, "auth_token", { path: "/" });
	return c.json({ message: "Logged out successfully" });
});

export { auth as authRoutes };
