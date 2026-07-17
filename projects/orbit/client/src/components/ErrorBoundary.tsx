/// <reference types="vite/client" />
import { Component, type ReactNode, type ErrorInfo } from "react";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log errors through the logger (suppressed in production to avoid leaking internals)
    logger.error("ErrorBoundary caught an error", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    // Send to Sentry in production
    captureException(error, {
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-75 w-full items-center justify-center p-8">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-8 text-center backdrop-blur-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-950/30 text-red-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-zinc-100">Something went wrong</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              An unexpected error occurred. This is likely temporary — try reloading the page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="max-w-full overflow-auto rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-[10px] text-red-400 text-left">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="mt-2 cursor-pointer rounded-full bg-zinc-100 px-5 py-2 text-[12px] md:text-sm font-bold text-black transition-all hover:bg-white active:scale-95"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
