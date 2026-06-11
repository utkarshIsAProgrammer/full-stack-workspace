import { Hono } from "hono";
import { authorRoutes } from "./routes/author";
import { authRoutes } from "./routes/auth";

const app = new Hono();

app.route("/users", authRoutes);
app.route("/authors", authorRoutes);

app.get("/", (c) => {
	return c.json({ message: "Hello Hono!" });
});

export default app;
