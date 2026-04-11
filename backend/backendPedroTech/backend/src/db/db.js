import { PrismaClient } from "@prisma/client";
import { process } from "zod/v4/core";

const prisma = new PrismaClient({
	log:
		process.env.NODE_ENV === "development"
			? ["query", "error", "warn"]
			: ["error"],
});

const connectDB = async () => {
	try {
		await prisma.$connect();
		console.log(`Postgres connected via Prisma!`);
	} catch (err) {
		console.log(`Error connecting postgres! ${err.message}`);
		process.exit(1);
	}
};

const disconnectDB = async () => {
	try {
		await prisma.$disconnect();
	} catch (err) {
		console.log(`Error disconnecting postgres! ${err.message}`);
	}
};

export { prisma, connectDB, disconnectDB };
