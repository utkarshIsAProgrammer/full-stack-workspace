import mongoose from "mongoose";

const mongoURI = process.env.MONGO_URI;

export const connectDB = async () => {
	try {
		if (!mongoURI) {
			return "mongoURI is not defined!";
		}
		const conn = await mongoose.connect(mongoURI);
		console.log(`mongoDB connected successfully! ${conn.connection.host}`);
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.log(`Error connecting mongoDB! ${error.message}`);
	}
};
