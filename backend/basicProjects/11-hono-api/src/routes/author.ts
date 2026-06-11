import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/db";
import { AuthorTable } from "../db/schema/authors";
import { eq } from "drizzle-orm";

import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { env } from "../data/env";

const authMiddleware = async (c: any, next: any) => {
	const authHeader = c.req.header("Authorization");
	let token: string | undefined;

	if (authHeader && authHeader.startsWith("Bearer ")) {
		token = authHeader.substring(7);
	} else {
		token = getCookie(c, "auth_token");
	}

	if (!token) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		const payload = await verify(token, env.JWT_SECRET, "HS256");
		c.set("jwtPayload", payload);
		await next();
	} catch (err) {
		return c.json({ error: "Unauthorized" }, 401);
	}
};

const author = new Hono();

interface Author {
	id: string;
	name: string;
	bday?: Date | null;
}

// Apply auth middleware to all author routes
author.use("*", authMiddleware);

// ZOD SCHEMA
const createAuthorSchema = z.object({
	name: z.string().min(1, "Value is required!"),
	bday: z.coerce.date().optional(),
});

const updateAuthorSchema = z.object({
	name: z.string().min(1, "Value is required!").optional(),
	bday: z.coerce.date().nullable().optional(),
});

// GET METHOD
author.get("/", async (c) => {
	const authors = await db.query.AuthorTable.findMany();
	return c.json(authors);
});

author.get("/:id", async (c) => {
	const { id } = c.req.param();
	const author = await db.query.AuthorTable.findFirst({
		where: (table, { eq }) => eq(table.id, id),
	});

	if (!author) {
		return c.json({ error: "Author not found" }, 404);
	}

	return c.json(author);
});

// POST METHOD
author.post("/", sValidator("json", createAuthorSchema), async (c) => {
	const data = c.req.valid("json");
	const author = await db.insert(AuthorTable).values(data).returning();
	return c.json(author, 201);
});

// PUT METHOD
author.put("/:id", sValidator("json", updateAuthorSchema), async (c) => {
	const { id } = c.req.param();
	const data = c.req.valid("json");

	const author = await db
		.update(AuthorTable)
		.set(data)
		.where(eq(AuthorTable.id, id))
		.returning();

	if (author.length === 0) {
		return c.json({ error: "Author not found" }, 404);
	}

	return c.json(author[0]);
});

// DELETE METHOD
author.delete("/:id", async (c) => {
	const { id } = c.req.param();
	const deletedAuthor = await db
		.delete(AuthorTable)
		.where(eq(AuthorTable.id, id))
		.returning();

	if (deletedAuthor.length === 0) {
		return c.json({ error: "Author not found" }, 404);
	}

	return c.json({ message: `Author with id ${id} deleted successfully` });
});

export { author as authorRoutes };
