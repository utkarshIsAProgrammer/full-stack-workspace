import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./utils/sentry";
import { trackPageView } from "./utils/analytics";

// Initialize Sentry for error tracking
initSentry();

// Track initial page view
trackPageView("home");

// Register Service Worker for PWA support after the app becomes idle.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
	const registerServiceWorker = () => {
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// Ignore registration failures; the app still works without the worker.
		});
	};

	if ("requestIdleCallback" in window) {
		window.requestIdleCallback(() => registerServiceWorker());
	} else {
		window.addEventListener("load", () =>
			window.setTimeout(registerServiceWorker, 1500),
		);
	}
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
