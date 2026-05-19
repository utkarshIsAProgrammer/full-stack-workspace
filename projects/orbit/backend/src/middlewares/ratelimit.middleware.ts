import rateLimit from "express-rate-limit";

// auth limiter
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,

  message: {
    success: false,
    message: "Too many login/signup attempts. Please try after some time.",
  },
});

// otp limiter
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,

  message: {
    success: false,
    message: "Too many OTP requests. Please try after some time.",
  },
});

// comments limiter
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,

  message: {
    success: false,
    message: "Too many comment requests. Please try after some time.",
  },
});

// interaction limiter
export const interactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,

  message: {
    success: false,
    message: "Too many actions performed. Please try after some time.",
  },
});
