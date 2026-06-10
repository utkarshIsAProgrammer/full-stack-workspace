/**
 * Dev-only logger — suppresses console output in production
 * to avoid leaking internal state and stack traces to end users.
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};
