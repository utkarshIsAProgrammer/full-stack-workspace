import mongoose from "mongoose";

export const connectDB = async () => {
	try {
		if (!process.env.MONGO_URI) {
			throw new Error("MONGO_URI is defined in environment variables!");
		}
		const conn = await mongoose.connect(process.env.MONGO_URI);
		console.log(`mongoDB connected successfully! ${conn.connection.host}`);
	} catch (err: any) {
		console.log(`Error connecting mongoDB! ${err.message}`);
		process.exit(1);
	}
};
