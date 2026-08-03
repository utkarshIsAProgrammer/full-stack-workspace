import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./utils/sentry";
import { trackPageView } from "./utils/analytics";
import { onLCP, onINP, onCLS, onFCP, onTTFB } from "web-vitals";
import * as Sentry from "@sentry/react";

// Initialize Sentry for error tracking
initSentry();

// Track initial page view
trackPageView("home");

// Report Web Vitals to Sentry for performance monitoring
function reportWebVitals() {
	onCLS((metric) => {
		Sentry.addBreadcrumb({ category: "web-vital", message: `CLS: ${metric.value}`, level: "info" });
	});
	onFCP((metric) => {
		Sentry.addBreadcrumb({ category: "web-vital", message: `FCP: ${metric.value}`, level: "info" });
	});
	onLCP((metric) => {
		Sentry.addBreadcrumb({ category: "web-vital", message: `LCP: ${metric.value}`, level: "info" });
	});
	onINP((metric) => {
		Sentry.addBreadcrumb({ category: "web-vital", message: `INP: ${metric.value}`, level: "info" });
	});
	onTTFB((metric) => {
		Sentry.addBreadcrumb({ category: "web-vital", message: `TTFB: ${metric.value}`, level: "info" });
	});
}

// Report after a short delay to let the page settle
if (import.meta.env.PROD) {
	setTimeout(reportWebVitals, 3000);
}

// Remove the old SW registration — vite-plugin-pwa handles it now
if ("serviceWorker" in navigator && import.meta.env.PROD) {
	// vite-plugin-pwa auto-registers via registerType: 'autoUpdate'
	// Only unregister old manual SW to avoid conflicts
	navigator.serviceWorker.getRegistrations().then((regs) => {
		regs.forEach((reg) => {
			if (reg.active?.scriptURL?.includes("/sw.js") && !reg.active?.scriptURL?.includes("workbox")) {
				reg.unregister();
			}
		});
	});
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
