import "dotenv/config";

const REQUIRED_VARS = [
  "MONGO_URI",
  "CLERK_SECRET_KEY",
  "STREAM_API_KEY",
  "STREAM_API_SECRET",
  "SENTRY_DSN",
  "CLIENT_URL",
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `Missing required environment variables:\n  ${missing.join("\n  ")}\n\n` +
      "Refer to .env.example for the complete list of required variables."
  );
  process.exit(1);
}

export const ENV = {
  PORT: process.env.PORT || 5001,
  MONGO_URI: process.env.MONGO_URI,
  NODE_ENV: process.env.NODE_ENV || "development",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  STREAM_API_KEY: process.env.STREAM_API_KEY,
  STREAM_API_SECRET: process.env.STREAM_API_SECRET,
  SENTRY_DSN: process.env.SENTRY_DSN,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
  CLIENT_URL: process.env.CLIENT_URL,
};
