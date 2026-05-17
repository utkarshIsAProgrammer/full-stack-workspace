"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectViews = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../models/user.model");
const protectViews = async (req, res, next) => {
    try {
        const token = req.cookies?.jwt;
        // no login → continue
        if (!token) {
            return next();
        }
        // verify token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // attach user
        const user = await user_model_1.User.findById(decoded.userId).select("-password");
        if (user) {
            req.user = user;
        }
        next();
    }
    catch {
        next();
    }
};
exports.protectViews = protectViews;
//# sourceMappingURL=view.middleware.js.map