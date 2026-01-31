import mongoose from "mongoose";
import "dotenv/config";

const mongo_uri = process.env.MONGO_URI;

export const connectDB = async () => {
	try {
		const conn = await mongoose.connect(mongo_uri);
		console.log("Database connected successfully!", conn.connection.host);
	} catch (err) {
		console.log("Error connecting database!", err.message);
		process.exit(1);
	}
};
