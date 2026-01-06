import mongoose from "mongoose";
import "dotenv/config";

const mongo_url = process.env.MONGO_URL;

const connectDB = async () => {
	try {
		await mongoose.connect(mongo_url);
		console.log("Database connect successfully!");
	} catch (err) {
		console.log("Error connecting database!", err.message);
		process.exit(1);
	}
};

export default connectDB;
