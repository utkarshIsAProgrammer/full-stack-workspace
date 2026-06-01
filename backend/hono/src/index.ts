import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { zValidator } from "@hono/zod-validator";
import { productQuerySchema } from "./products.schema";

const app = new Hono();

// serves static files
app.use("/static/*", serveStatic({ root: "./" }));

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

// wrong api call handler
app.notFound((c) => {
	return c.json({ message: "Not Found" }, 404);
});

// 6 digit id within the scope of 0-9 is only valid
app.get("/products/:id{[0-9]{6}}", async (c) => {
	const { id } = c.req.param();
	return c.json({ id, message: `Available product ID: ${id}` }, 200);
});

// invalid id handler
app.get("/products/:id", (c) => {
	return c.json(
		{ message: "Invalid product ID format. ID must be a 6-digit number." },
		400,
	);
});

// zod with hono
app.get("/products", zValidator("query", productQuerySchema), async (c) => {
	const data = c.req.valid("query");
	return c.json(data);
});

app.post("/products", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	return c.json(
		{ message: "Product created successfully", received: body },
		201,
	);
});
export default app;
