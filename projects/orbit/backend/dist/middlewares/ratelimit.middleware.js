"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionLimiter = exports.commentLimiter = exports.otpLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// auth limiter
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: "Too many login/signup attempts. Please try after some time.",
    },
});
// otp limiter
exports.otpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        message: "Too many OTP requests. Please try after some time.",
    },
});
// comments limiter
exports.commentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: "Too many comment requests. Please try after some time.",
    },
});
// interaction limiter
exports.interactionLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: "Too many actions performed. Please try after some time.",
    },
});
//# sourceMappingURL=ratelimit.middleware.js.map