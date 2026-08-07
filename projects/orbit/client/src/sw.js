/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// ─── Static precache (injected at build time by vite-plugin-pwa) ────
const __manifest = self.__WB_MANIFEST || [];
precacheAndRoute(__manifest);
cleanupOutdatedCaches();

// ─── App shell navigation fallback (SPA) ─────────────────────────
// Only register when /index.html is ACTUALLY precached. In dev the plugin
// injects an EMPTY manifest (precacheAndRoute([])), and calling
// createHandlerBoundToURL('/index.html') on an uncached URL throws during
// module evaluation — which kills the ENTIRE service worker (and with it
// web-push notifications). Guarding this keeps the dev SW alive so push
// works locally as well as in production builds.
const hasAppShell = __manifest.some((entry) =>
  typeof entry === 'string' ? entry === 'index.html' : entry?.url === 'index.html',
);
if (hasAppShell) {
  registerRoute(
    ({ request, url }) =>
      request.mode === 'navigate' &&
      url.origin === self.location.origin &&
      !url.pathname.startsWith('/api') &&
      !url.pathname.startsWith('/socket.io'),
    createHandlerBoundToURL('/index.html'),
  );
}

// ─── Runtime caching (same strategy as the previous generateSW config) ──
registerRoute(
  /^https?:\/\/.*\/api\/chats\/conversations\/.*\/messages/i,
  new NetworkFirst({
    cacheName: 'orbit-chat-messages',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
    networkTimeoutSeconds: 3,
  }),
);

registerRoute(
  /^https?:\/\/.*\/api\/.*/i,
  new NetworkFirst({
    cacheName: 'orbit-api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
    ],
    networkTimeoutSeconds: 5,
  }),
);

registerRoute(
  /^https?:\/\/res\.cloudinary\.com\/.*\/(image|video)\/upload\/.*/i,
  new CacheFirst({
    cacheName: 'orbit-cloudinary-media',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

registerRoute(
  /^https?:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)/i,
  new CacheFirst({
    cacheName: 'orbit-image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

registerRoute(
  /^https?:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)/i,
  new StaleWhileRevalidate({
    cacheName: 'orbit-font-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 60 }),
    ],
  }),
);

registerRoute(
  /^https?:\/\/.*\.(?:mp3|mp4|aac|ogg|wav|webm|m4a)/i,
  new CacheFirst({
    cacheName: 'orbit-audio-video',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  }),
);

// ─── Web Push Notifications ───────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Message from the app: e.g. skip-waiting on new SW version
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// The critical handler — display the device notification when the
// server sends a web-push payload.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    // Fallback for plain-text payloads
    event.waitUntil(
      self.registration.showNotification('ORBIT', {
        body: event.data.text(),
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      }),
    );
    return;
  }

  const { title, body, icon, badge, image, vibrate, actions, data: payloadData, tag, requireInteraction, renotify, timestamp } = data;

  const options = {
    body: body || '',
    icon: icon || '/icon-192.png',
    badge: badge || '/icon-192.png',
    data: payloadData || {},
    vibrate: vibrate || [200, 100, 200],
    ...(timestamp && { timestamp: new Date(timestamp).getTime() }),
    ...(tag && { tag }),
    ...(requireInteraction !== undefined && { requireInteraction }),
    ...(renotify !== undefined && { renotify }),
    ...(image && { image }),
    ...(actions && { actions }),
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title || 'ORBIT', options);
      // Update the launcher badge (Android) with the unread count carried
      // in the payload (data.unreadCount) — like real social apps.
      const unread = payloadData?.unreadCount;
      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        try {
          const count = Number(unread) || 0;
          if (count > 0) {
            await navigator.setAppBadge(count);
          } else {
            await navigator.clearAppBadge();
          }
        } catch {
          /* badge unsupported — ignore */
        }
      }
    })(),
  );
});

// Click on a notification → focus the app, navigate to the target URL
// carried in the payload (post, profile, notifications, chat, etc.),
// mark the notification read server-side, and clear the launcher badge.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const payloadData = event.notification.data || {};
  const urlToOpen = payloadData.url || '/';

  event.waitUntil(
    (async () => {
      // Mark the notification as read so in-app counts stay accurate
      const notificationId = payloadData.notificationId;
      if (notificationId) {
        try {
          await fetch(`/api/notifications/mark-as-read/${notificationId}`, {
            method: 'PUT',
            credentials: 'include',
          });
        } catch {
          /* best-effort — non-critical */
        }
      }

      // Clear the launcher badge when the user acts on a notification
      if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
        try {
          await navigator.clearAppBadge();
        } catch {
          /* ignore */
        }
      }

      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      // Focus an existing ORBIT window and navigate it to the target
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          try {
            client.navigate(urlToOpen);
          } catch {
            // Navigation not supported on this client — ignore
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })(),
  );
});

self.addEventListener('notificationclose', (event) => {
  // Analytics / dismissal tracking could be hooked here
});
