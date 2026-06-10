"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../models/user.model");
const env_1 = require("../configs/env");
const cache_1 = require("../configs/cache");
const protect = async (req, res, next) => {
    try {
        // get token from cookies or Authorization header
        let token = req.cookies?.jwt;
        if (!token && req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized - No token",
            });
        }
        // verify the token is using secret key
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET, {
            issuer: "orbit",
            audience: "orbit-users",
        });
        // fetch user from cache or db and exclude password field
        const cacheKey = `auth:user:${decoded.userId}`;
        let user = await (0, cache_1.getCache)(cacheKey);
        if (!user) {
            user = await user_model_1.User.findById(decoded.userId).select("-password").lean();
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found!",
                });
            }
            // cache for 5 minutes
            await (0, cache_1.setCache)(cacheKey, user, 300);
        }
        // attach user to request object
        req.user = user;
        next();
    }
    catch (err) {
        let message = "Invalid token!";
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            message = "Token expired!";
        }
        else if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            message = "Invalid token!";
        }
        return res.status(401).json({
            success: false,
            message,
        });
    }
};
exports.protect = protect;
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.cookies?.jwt;
        if (!token && req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) {
            return next();
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET, {
            issuer: "orbit",
            audience: "orbit-users",
        });
        const cacheKey = `auth:user:${decoded.userId}`;
        let user = await (0, cache_1.getCache)(cacheKey);
        if (!user) {
            user = await user_model_1.User.findById(decoded.userId).select("-password").lean();
            if (user) {
                await (0, cache_1.setCache)(cacheKey, user, 300);
            }
        }
        if (user) {
            req.user = user;
        }
        next();
    }
    catch (err) {
        // silently ignore token errors for optional auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.middleware.js.map