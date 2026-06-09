type LogLevel = "debug" | "info" | "warn" | "error";

interface LogData {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const log = (level: LogLevel, message: string, meta: Record<string, unknown> = {}) => {
  const logData: LogData = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  if (level === "error") {
    console.error(JSON.stringify(logData));
  } else if (level === "warn") {
    console.warn(JSON.stringify(logData));
  } else {
    console.log(JSON.stringify(logData));
  }
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
