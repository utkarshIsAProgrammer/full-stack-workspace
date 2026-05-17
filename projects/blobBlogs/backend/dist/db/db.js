"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is defined in environment variables!");
        }
        const conn = await mongoose_1.default.connect(process.env.MONGO_URI);
        console.log(`mongoDB connected successfully! ${conn.connection.host}`);
    }
    catch (err) {
        console.log(`Error connecting mongoDB! ${err.message}`);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
//# sourceMappingURL=db.js.map