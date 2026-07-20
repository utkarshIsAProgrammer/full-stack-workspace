import { logger } from "./logger";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

/**
 * Check the current push notification permission state.
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Request push notification permission from the user.
 * Shows a native browser prompt.
 *
 * @returns The resulting permission state after the user responds
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    logger.error("Failed to request notification permission", err);
    return "denied";
  }
}

/**
 * Show a browser push notification.
 *
 * @param title Notification title
 * @param options Optional Notification options (body, icon, etc.)
 */
export function showBrowserNotification(
  title: string,
  options?: NotificationOptions,
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, {
      icon: "/vite.svg",
      ...options,
    });
  } catch (err) {
    logger.error("Failed to show notification", err);
  }
}

/**
 * Check if the browser supports push notifications.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
