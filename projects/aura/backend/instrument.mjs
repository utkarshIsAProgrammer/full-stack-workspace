import * as Sentry from "@sentry/node";
import { ENV } from "./src/config/env.js";

const isProd = ENV.NODE_ENV === "production";

Sentry.init({
  dsn: ENV.SENTRY_DSN,
  tracesSampleRate: isProd ? 0.1 : 1.0,
  profilesSampleRate: isProd ? 0.1 : undefined,
  environment: ENV.NODE_ENV || "development",
  includeLocalVariables: true,

  // Only send PII in development for debugging; disable in production for compliance
  sendDefaultPii: !isProd,
});
