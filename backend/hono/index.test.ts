import { describe, it, expect } from "bun:test";
import app from "./src/index";

// Bun Testing
describe("Hono Product API", () => {
	it("should return 200 for a valid 6-digit numeric ID", async () => {
		const res = await app.request("/products/123456");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe("123456");
	});

	it("should return 400 for an ID that is not 6 digits", async () => {
		const res = await app.request("/products/123");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.message).toBe(
			"Invalid product ID format. ID must be a 6-digit number.",
		);
	});

	it("should return 400 for a non-numeric ID", async () => {
		const res = await app.request("/products/abc123");
		expect(res.status).toBe(400);
	});
});
