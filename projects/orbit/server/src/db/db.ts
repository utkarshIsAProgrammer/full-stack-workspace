import mongoose from "mongoose";
import { env } from "../configs/env";
import { logger } from "../utilities/logger";

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

export const connectDB = async (retryCount = 0): Promise<mongoose.Connection> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
    });

    logger.info(`MongoDB connected successfully!`, { host: conn.connection.host });

    // Clean up old 'glimpses' collection if it exists to ensure it is not created again
    try {
      const db = conn.connection.db;
      if (db) {
        const collections = await db.listCollections({ name: "glimpses" }).toArray();
        if (collections.length > 0) {
          await db.dropCollection("glimpses");
          logger.info("Successfully dropped deprecated 'glimpses' collection from MongoDB");
        }
      }
    } catch (dbErr: any) {
      logger.warn("Failed to drop deprecated 'glimpses' collection", { error: dbErr.message });
    }

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error", { error: err.message });
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });

    return conn.connection;
  } catch (err: any) {
    logger.error("MongoDB connection failed", { error: err.message, attempt: retryCount + 1 });

    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying MongoDB connection in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDB(retryCount + 1);
    } else {
      logger.error("Max retries reached, could not connect to MongoDB");
      throw new Error("Failed to connect to MongoDB after max retries");
    }
  }
}