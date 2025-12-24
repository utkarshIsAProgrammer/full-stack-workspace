import mongoose from "mongoose";
import "dotenv/config"; // must import for .env

// db connection function
const connectDB = async (DATABASE_URL) => {
	try {
		await mongoose.connect(DATABASE_URL);
		console.log("Database connected successfully...");
	} catch (err) {
		console.log(err);
	}
};

export default connectDB;
