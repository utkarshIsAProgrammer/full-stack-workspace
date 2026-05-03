/**
 * @file db.ts
 * @description Database configuration and connection logic using Mongoose.
 */

import mongoose from "mongoose";

/**
 * Connects to the MongoDB database using the URI provided in environment variables.
 * @async
 * @function connectDB
 * @throws Will throw an error if MONGO_URI is not defined or connection fails.
 */
export const connectDB = async () => {
	try {
		if (!process.env.MONGO_URI) {
			throw new Error("MONGO_URI is defined in environment variables!");
		}
		const conn = await mongoose.connect(process.env.MONGO_URI);
		console.log(`mongoDB connected successfully! ${conn.connection.host}`);
	} catch (err: any) {
		console.log(`Error connecting mongoDB! ${err.message}`);
		// Exit process with failure
		process.exit(1);
	}
};
