import "dotenv/config";
import mongoose from "mongoose";

const mongoURI = process.env.MONGO_URI;

export const connectDB = async () => {
	try {
		const conn = await mongoose.connect(mongoURI);
		console.log(`MongoDB connected successfully! ${conn.connection.host}`);
	} catch (err) {
		console.log("Error connecting MongoDB!", err.message);
		process.exit(1);
	}
};
