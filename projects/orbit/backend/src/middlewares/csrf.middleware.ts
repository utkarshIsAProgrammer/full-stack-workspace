import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { env } from "../configs/env";

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

// Methods that are considered "state-changing" and need CSRF protection
const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

// Safe origins that are allowed to make state-changing requests
const getTrustedOrigins = (): string[] => {
  const origins = [env.CLIENT_URL.replace(/\/$/, "")];
  if (env.NODE_ENV === "development") {
    origins.push("http://localhost:5173", "http://localhost:5174");
  }
  return origins;
};

/**
 * Middleware that generates a CSRF token and sets it as a cookie.
 * Should be called once on login/session creation.
 */
export const setCsrfCookie = (res: Response) => {
  const token = randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // client JS needs to read it
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matching JWT cookie maxAge)
  });
  return token;
};

/**
 * Middleware that validates CSRF token on state-changing requests.
 * Uses the double-submit cookie pattern: the client reads the CSRF
 * cookie and sends it back as a header. The server compares both.
 */
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
  if (env.NODE_ENV === "development") {
    const origin = req.headers.origin || "";
    const trustedOrigins = getTrustedOrigins();
    if (trustedOrigins.some((o) => origin.startsWith(o))) {
      return next();
    }
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

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

/**
 * Helper for the client to read the CSRF cookie value.
 * CSRF cookie is non-httpOnly so JS can access it.
 */
export const getCsrfCookieName = () => CSRF_COOKIE_NAME;
export const getCsrfHeaderName = () => CSRF_HEADER_NAME;
