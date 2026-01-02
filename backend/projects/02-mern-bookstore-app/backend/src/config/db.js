import mongoose, { connect } from "mongoose";
import "dotenv/config";

const mongoURL = process.env.MONGO_URL;

const connectDB = async () => {
	try {
		await mongoose.connect(mongoURL);
		console.log("Database connected successfully!");
	} catch (err) {
		console.log("Error connecting database!", err);
		process.exit(1);
	}
};

export default connectDB;
