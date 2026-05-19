"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../models/user.model");
const protect = async (req, res, next) => {
    try {
        // get token from cookies
        const token = req.cookies?.jwt;
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized - No token",
            });
        }
        // verify the token is using secret key
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // fetch user from db and exclude password field
        const user = await user_model_1.User.findById(decoded.userId).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found!",
            });
        }
        // attach user to request object
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token!",
        });
    }
};
exports.protect = protect;
//# sourceMappingURL=auth.middleware.js.map