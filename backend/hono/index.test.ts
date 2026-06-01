import { describe, it, expect } from "bun:test";
import app from "./src/index";

describe("Hono Product API", () => {
	// Tests for individual product retrieval and ID format validation
	it("should return 200 for a valid 6-digit numeric ID", async () => {
		// The regex /:id{[0-9]{6}} ensures only exactly 6 digits match this route
		const res = await app.request("/products/123456");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe("123456");
	});

	it("should return 400 for an ID that is not 6 digits", async () => {
		// If the ID is shorter or longer than 6 digits, it falls through to the catch-all /:id route
		const res = await app.request("/products/123");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.message).toBe(
			"Invalid product ID format. ID must be a 6-digit number.",
		);
	});

	it("should return 400 for a non-numeric ID", async () => {
		// Non-numeric strings should also fail the regex and trigger the 400 handler
		const res = await app.request("/products/abc123");
		expect(res.status).toBe(400);
	});

	// Tests for the product list endpoint and its query parameter validation using Zod
	describe("GET /products query validation", () => {
		// Verifies that the .default() values in the Zod schema work correctly
		it("should return default values when no query is provided", async () => {
			const res = await app.request("/products");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toEqual({ minPrice: 0, maxPrice: 1000 });
		});

		// Verifies that z.coerce.number() correctly handles string inputs from the URL
		it("should accept custom minPrice and maxPrice", async () => {
			const res = await app.request(
				"/products?minPrice=150&maxPrice=3000",
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toEqual({ minPrice: 150, maxPrice: 3000 });
		});

		// Verifies that invalid types in query parameters return a 400 Bad Request
		it("should return 400 for non-numeric query parameters", async () => {
			const res = await app.request("/products?minPrice=expensive");
			expect(res.status).toBe(400);
		});
	});

	// Tests for product creation logic
	describe("POST /products", () => {
		it("should return 201 and echoes the body", async () => {
			// Testing POST requests requires passing the method and body in the Request init object
			const res = await app.request("/products", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Gaming Mouse" }),
			});
			expect(res.status).toBe(201);
			const body = await res.json();
			expect(body.message).toBe("Product created successfully");
			expect(body.received.name).toBe("Gaming Mouse");
		});
	});
});
