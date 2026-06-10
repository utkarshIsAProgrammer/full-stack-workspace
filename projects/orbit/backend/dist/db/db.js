"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../configs/env");
const logger_1 = require("../utilities/logger");
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;
const connectDB = async (retryCount = 0) => {
    try {
        const conn = await mongoose_1.default.connect(env_1.env.MONGO_URI, {
            maxPoolSize: 50,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            retryReads: true,
        });
        logger_1.logger.info(`MongoDB connected successfully!`, { host: conn.connection.host });
        mongoose_1.default.connection.on("error", (err) => {
            logger_1.logger.error("MongoDB connection error", { error: err.message });
        });
        mongoose_1.default.connection.on("disconnected", () => {
            logger_1.logger.warn("MongoDB disconnected");
        });
        mongoose_1.default.connection.on("reconnected", () => {
            logger_1.logger.info("MongoDB reconnected");
        });
        return conn.connection;
    }
    catch (err) {
        logger_1.logger.error("MongoDB connection failed", { error: err.message, attempt: retryCount + 1 });
        if (retryCount < MAX_RETRIES) {
            logger_1.logger.info(`Retrying MongoDB connection in ${RETRY_DELAY / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return (0, exports.connectDB)(retryCount + 1);
        }
        else {
            logger_1.logger.error("Max retries reached, could not connect to MongoDB");
            throw new Error("Failed to connect to MongoDB after max retries");
        }
    }
};
exports.connectDB = connectDB;
//# sourceMappingURL=db.js.map