import mongoose from "mongoose";

const mongoURI = process.env.MONGO_URI;

export const connectDB = async () => {
	try {
		const conn = await mongoose.connect(mongoURI);
		console.log(`mongoDB connected successfully! ${conn.connection.host}`);
	} catch (err) {
		console.log(`Error connecting mongoDB! ${err.message}`);
		process.exit(1);
	}
};
