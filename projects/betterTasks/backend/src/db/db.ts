import mongoose from "mongoose";

export const connectDB = async () => {
	try {
		if (!process.env.MONGO_URI) {
			throw new Error(
				"MongoDB URI is not defined in the environment variables!",
			);
		}

		const conn = await mongoose.connect(process.env.MONGO_URI);
		console.log(`mongoDB connected successfully! ${conn.connection.host}`);
	} catch (err) {
		const error = err instanceof Error ? err : new Error("Unknown error!");
		console.log(`Error connecting mongoDB! ${error.message}`);
	}
};
