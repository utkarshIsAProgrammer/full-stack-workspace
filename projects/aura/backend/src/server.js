import "../instrument.mjs";
import express from "express";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { functions, inngest } from "./config/inngest.js";
import { serve } from "inngest/express";
import chatRoutes from "./routes/chat.route.js";

import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import * as Sentry from "@sentry/node";

const app = express();

// --- Global middleware ---
app.use(express.json());
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware());

// Request logging — skip in test environments
if (ENV.NODE_ENV !== "test") {
  app.use(morgan(ENV.NODE_ENV === "production" ? "combined" : "dev"));
}

// Rate limiting — exclude Inngest webhook route to avoid blocking Clerk events
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skip: (req) => req.path.startsWith("/api/inngest"),
});
app.use("/api", apiLimiter);

// --- Routes ---

// Health check — must be before Sentry error handler
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV,
  });
});

app.get("/debug-sentry", (req, res) => {
  throw new Error("My first Sentry error!");
});

app.get("/", (req, res) => {
  res.send("Hello World! 123");
});

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);

// Sentry error handler — must come after all routes
Sentry.setupExpressErrorHandler(app);

// --- Server startup ---
const startServer = async () => {
  await connectDB();
  if (ENV.NODE_ENV !== "production") {
    app.listen(ENV.PORT, () => {
      console.log("Server started on port:", ENV.PORT);
    });
  }
};

startServer();

export default app;
