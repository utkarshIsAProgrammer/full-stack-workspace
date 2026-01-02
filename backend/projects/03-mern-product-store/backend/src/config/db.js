import mongoose, { mongo } from "mongoose";
import "dotenv/config";

const mongoURL = process.env.MONGO_URL;

// connection to database
const connectDB = async () => {
	try {
		await mongoose.connect(mongoURL);
		console.log("Database connected successfully!");
	} catch (err) {
		console.log("Error connecting database!");
		process.exit(1);
	}
};

export default connectDB;
