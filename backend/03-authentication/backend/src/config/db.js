import mongoose from "mongoose";
import "dotenv/config";

const mongo_url = process.env.MONGO_URL;

export const connectDB = async () => {
	try {
		await mongoose.connect(mongo_url);
		console.log("Database connected successfully!");
	} catch (err) {
		console.log("Error connecting database!");
		process.exit(1);
	}
};
