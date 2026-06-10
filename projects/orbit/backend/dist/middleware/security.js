"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityHeaders = void 0;
/**
 * Content Security Policy middleware to prevent XSS attacks
 * and other content injection vulnerabilities
 */
const securityHeaders = (req, res, next) => {
    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
        "img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com; " +
        "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; " +
        "connect-src 'self' https://*.unsplash.com https://api.unsplash.com; " +
        "media-src 'self' blob: data:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'; " +
        "upgrade-insecure-requests;");
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    // HSTS (only in production)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
};
exports.securityHeaders = securityHeaders;
//# sourceMappingURL=security.js.map