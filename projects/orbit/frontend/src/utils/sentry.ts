import * as Sentry from "@sentry/react";

// Initialize Sentry for error tracking and performance monitoring
export const initSentry = () => {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
      beforeSend(event, hint) {
        // Filter out certain errors if needed
        if (event.exception) {
          const error = hint.originalException;
          // Ignore specific error types if needed
          if (error instanceof Error && error.message.includes("ResizeObserver")) {
            return null;
          }
        }
        return event;
      },
    });
  }
};

export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

export const captureMessage = (message: string, level: "info" | "warning" | "error" = "info", context?: Record<string, any>) => {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
};

export const setUserContext = (user: { id: string; username: string; email: string }) => {
  Sentry.setUser({
    id: user.id,
    username: user.username,
    email: user.email,
  });
};

export const clearUserContext = () => {
  Sentry.setUser(null);
};
