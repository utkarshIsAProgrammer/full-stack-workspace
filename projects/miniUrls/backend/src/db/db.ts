import mongoose from "mongoose";

// connect to mongodb database
export const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in the environment variables!");
    }
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`mongoDB connected successfully! ${conn.connection.host}`);
  } catch (err: any) {
    console.log(`Error connecting mongoDB! ${err.message}`);
    process.exit(1);
  }
};
