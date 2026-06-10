"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCsrfHeaderName = exports.getCsrfCookieName = exports.csrfProtection = exports.setCsrfCookie = void 0;
const crypto_1 = require("crypto");
const env_1 = require("../configs/env");
const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
// Methods that are considered "state-changing" and need CSRF protection
const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
// Safe origins that are allowed to make state-changing requests
const getTrustedOrigins = () => {
    const origins = [env_1.env.CLIENT_URL.replace(/\/$/, "")];
    if (env_1.env.NODE_ENV === "development") {
        origins.push("http://localhost:5173", "http://localhost:5174");
    }
    return origins;
};
/**
 * Middleware that generates a CSRF token and sets it as a cookie.
 * Should be called once on login/session creation.
 */
const setCsrfCookie = (res) => {
    const token = (0, crypto_1.randomBytes)(32).toString("hex");
    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // client JS needs to read it
        secure: env_1.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matching JWT cookie maxAge)
    });
    return token;
};
exports.setCsrfCookie = setCsrfCookie;
/**
 * Middleware that validates CSRF token on state-changing requests.
 * Uses the double-submit cookie pattern: the client reads the CSRF
 * cookie and sends it back as a header. The server compares both.
 */
const csrfProtection = (req, res, next) => {
    // Only protect state-changing methods
    if (!STATE_CHANGING_METHODS.includes(req.method)) {
        return next();
    }
    // Bypass CSRF for Bearer token authenticated requests (immune to CSRF)
    if (req.headers.authorization?.startsWith("Bearer ")) {
        return next();
    }
    // Exclude public authentication and password reset endpoints
    const publicPaths = [
        "/api/auth/signup",
        "/api/auth/login",
        "/api/password/request-otp",
        "/api/password/forgot",
        "/api/password/verify-and-forgot-password",
        "/api/password/reset",
    ];
    if (publicPaths.includes(req.path)) {
        return next();
    }
    // In development, allow requests from localhost without CSRF check
    if (env_1.env.NODE_ENV === "development") {
        const origin = req.headers.origin || "";
        const trustedOrigins = getTrustedOrigins();
        if (trustedOrigins.some((o) => origin.startsWith(o))) {
            return next();
        }
    }
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];
    if (!cookieToken || !headerToken) {
        return res.status(403).json({
            success: false,
            message: "CSRF token missing — security check failed.",
        });
    }
    if (cookieToken !== headerToken) {
        return res.status(403).json({
            success: false,
            message: "CSRF token mismatch — security check failed.",
        });
    }
    next();
};
exports.csrfProtection = csrfProtection;
/**
 * Helper for the client to read the CSRF cookie value.
 * CSRF cookie is non-httpOnly so JS can access it.
 */
const getCsrfCookieName = () => CSRF_COOKIE_NAME;
exports.getCsrfCookieName = getCsrfCookieName;
const getCsrfHeaderName = () => CSRF_HEADER_NAME;
exports.getCsrfHeaderName = getCsrfHeaderName;
//# sourceMappingURL=csrf.middleware.js.map