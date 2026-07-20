import webPush from "web-push";
import { env } from "../configs/env";
import { logger } from "../utilities/logger";
import DeviceSubscription from "../models/deviceSubscription.model";

// ─── VAPID keys are generated once and configured via env vars ─────

const vapidSubject = env.VAPID_SUBJECT || "mailto:orbit@example.com";
const vapidPublicKey = env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = env.VAPID_PRIVATE_KEY || "";

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

/**
 * Send a push notification to all devices registered for a user.
 * Fires in a fire-and-forget manner — failures are logged but never thrown.
 */
export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    image?: string;
    data?: Record<string, unknown>;
    tag?: string;
    requireInteraction?: boolean;
  }
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    logger.warn("Push notifications not configured — missing VAPID keys");
    return;
  }

  try {
    const subscriptions = await DeviceSubscription.find({ user: userId })
      .select("subscription")
      .lean();

    if (subscriptions.length === 0) return;

    const pushPayload = JSON.stringify(payload);
    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const s = sub.subscription as webPush.PushSubscription;
        try {
          await webPush.sendNotification(s, pushPayload);
        } catch (err: any) {
          // 410 Gone / 404 Not Found — the subscription is expired or invalid
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleEndpoints.push((s as any).endpoint);
          } else {
            logger.error("Failed to send push notification", {
              error: err.message,
              endpoint: (s as any).endpoint?.substring(0, 50),
            });
          }
        }
      })
    );

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await DeviceSubscription.deleteMany({
        user: userId,
        "subscription.endpoint": { $in: staleEndpoints },
      });
      logger.info("Cleaned up stale push subscriptions", {
        userId,
        count: staleEndpoints.length,
      });
    }
  } catch (err: any) {
    logger.error("Error in sendPushToUser", { error: err.message, userId });
  }
}

/**
 * Build a notification payload from an in-app notification document.
 */
export function buildPushPayload(notification: any): {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
  tag: string;
  requireInteraction: boolean;
} {
  const senderName = notification.sender?.fullName || notification.sender?.username || "Someone";
  const senderPic = notification.sender?.profilePic?.url || "/vite.svg";

  const typeConfig: Record<string, { title: string; body: string }> = {
    like: { title: senderName, body: "liked your post" },
    comment: { title: senderName, body: "commented on your post" },
    follow: { title: senderName, body: "started following you" },
    repost: { title: senderName, body: "reposted your post" },
    save: { title: senderName, body: "saved your post" },
    mention: { title: senderName, body: "mentioned you in a post" },
    reaction: { title: senderName, body: "reacted to your message" },
    message_reply: { title: senderName, body: "replied to your message" },
    glimpse_reaction: { title: senderName, body: "reacted to your story" },
    glimpse_reply: { title: senderName, body: "replied to your story" },
    poll_vote: { title: senderName, body: "voted in your poll" },
    collab_invite: { title: senderName, body: "invited you to collaborate" },
    follow_request: { title: senderName, body: "wants to follow you" },
    daily_reward: { title: "Daily Reward", body: "Your daily reward is ready!" },
    streak_reminder: { title: "Streak Reminder", body: "Don't lose your streak!" },
    room_invite: { title: senderName, body: "invited you to an audio room" },
    invite_accepted: { title: senderName, body: "accepted your invitation" },
  };

  const config = typeConfig[notification.type] || {
    title: "Orbit",
    body: "You have a new notification",
  };

  return {
    title: config.title,
    body: config.body,
    icon: senderPic,
    tag: `orbit-${notification._id || notification.type}`,
    requireInteraction: notification.type === "follow_request" || notification.type === "collab_invite",
    data: {
      url: notification.post?.slug
        ? `/post/${notification.post.slug}`
        : notification.post?.toString()
          ? `/post/${notification.post.toString()}`
          : notification.type === "follow"
            ? `/u/${notification.sender?.username}`
            : "/notifications",
      type: notification.type,
      notificationId: notification._id,
    },
  };
}
