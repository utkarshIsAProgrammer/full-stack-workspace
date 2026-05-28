import { Client } from "pg";
import "dotenv/config"; // To load .env file
import { URL } from "url";

async function testDbConnection() {
	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		console.error("DATABASE_URL is not set in the environment variables.");
		return;
	}

	// Parse the URL to get its components
	const parsedUrl = new URL(connectionString);

	// URL-encode the password if it exists
	if (parsedUrl.password) {
		parsedUrl.password = encodeURIComponent(parsedUrl.password);
	}

	// Reconstruct the connection string with the encoded password
	const encodedConnectionString = parsedUrl.toString();

	const client = new Client({
		connectionString: encodedConnectionString,
	});

	try {
		await client.connect();
		console.log("Successfully connected to the database!");
	} catch (error) {
		console.error("Failed to connect to the database:", error);
	} finally {
		await client.end();
	}
}

testDbConnection();
