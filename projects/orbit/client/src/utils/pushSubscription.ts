import { logger } from "./logger";
import { apiFetch } from "./api";

/**
 * URL-safe base64 to Uint8Array (for applicationServerKey conversion)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported by the browser.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Fetch the VAPID public key from the server.
 */
async function getVapidKey(): Promise<string | null> {
  try {
    const res = await apiFetch("/api/push/vapid-key");
    const data = await res.json();
    if (res.ok && data.success && data.publicKey) {
      return data.publicKey;
    }
    return null;
  } catch (err) {
    logger.error("Failed to fetch VAPID key", err);
    return null;
  }
}

/**
 * Subscribe the current user to push notifications.
 * This must be called after the user grants notification permission.
 *
 * @returns true if subscription was successful
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    logger.warn("Push notifications not supported in this browser");
    return false;
  }

  try {
    // Step 1: Register service worker (if not already)
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Step 2: Get VAPID public key from server
    const vapidKey = await getVapidKey();
    if (!vapidKey) {
      logger.warn("No VAPID key available — push not configured on server");
      return false;
    }

    // Step 3: Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // Step 4: Subscribe if not already subscribed
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Step 5: Send subscription to our backend
    const res = await apiFetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: (subscription as any).toJSON().keys?.p256dh || "",
          auth: (subscription as any).toJSON().keys?.auth || "",
        },
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      logger.warn("Push subscribe API returned error", data.message);
      return false;
    }

    return true;
  } catch (err) {
    logger.error("Failed to subscribe to push notifications", err);
    return false;
  }
}

/**
 * Unsubscribe the current user from push notifications.
 *
 * @returns true if unsubscription was successful
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Unsubscribe from the push service
      await subscription.unsubscribe();

      // Notify our backend
      await apiFetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      }).catch(() => {
        // Silently fail — local unsubscribe is what matters
      });
    }

    return true;
  } catch (err) {
    logger.error("Failed to unsubscribe from push notifications", err);
    return false;
  }
}

/**
 * Check the current push subscription status.
 */
export async function getPushSubscriptionStatus(): Promise<{
  subscribed: boolean;
  permission: NotificationPermission | "unsupported";
}> {
  if (!isPushSupported()) {
    return { subscribed: false, permission: "unsupported" };
  }

  const permission = Notification.permission;
  let subscribed = false;

  if (permission === "granted") {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      subscribed = !!subscription;
    } catch {
      subscribed = false;
    }
  }

  return { subscribed, permission };
}
