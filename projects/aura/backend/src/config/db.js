import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("MongoDB connected successfully:", conn.connection.host);
  } catch (error) {
    // Don't crash the server — log the error and let the server start anyway.
    // Routes that need the DB can handle the missing connection gracefully.
    console.error("Error connecting to MongoDB:", error.message);
    console.log("Server will start without database connectivity.");
  }
};
