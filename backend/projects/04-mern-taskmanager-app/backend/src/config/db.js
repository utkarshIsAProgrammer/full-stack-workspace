import mongoose from "mongoose";
import "dotenv/config";

const mongodb_url = process.env.MONGO_URL;

// connect db
const connectDB = async () => {
	try {
		await mongoose.connect(mongodb_url);
		console.log("Database connected successfully!");
	} catch (err) {
		console.log("Error connecting database!");
		process.exit(1);
	}
};

export default connectDB;
