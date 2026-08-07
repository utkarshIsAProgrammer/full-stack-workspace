import Notification from "../models/notification.model";
import { User } from "../models/user.model";
import { EmailPreference } from "../models/emailPreference.model";
import { sendNotification } from "../configs/socket";
import { clearByPattern, deleteCache } from "../configs/cache";
import { sendPushToUser, buildPushPayload } from "../services/pushService";
import { areMutuallyBlocked } from "./blockCheck";
import { logger } from "./logger";

/**
 * Invalidate all cached notification data for a recipient.
 *
 * The notifications list (`getNotifications`) is cached under
 * `notifications:${userId}:*` and the unread badge count under
 * `notifications:unread:${userId}`. The route-level `cacheMiddleware`
 * additionally caches GET responses under `api:${userId}:*`.
 * Without this invalidation, a newly created notification (or a deletion)
 * would stay invisible for the full cache TTL, so the bell badge / list
 * would appear stale (e.g. "0 unread" even though a new message arrived).
 */
export const invalidateRecipientNotificationCaches = async (recipientId: string) => {
  try {
    await Promise.allSettled([
      // Controller-level caches: notifications list + unread badge count
      clearByPattern(`notifications:${recipientId}:*`),
      deleteCache(`notifications:unread:${recipientId}`),
      // Route-level cacheMiddleware keys (format: api:<userId>:<path>:<query>).
      // Narrowly match ONLY the notifications routes — the list mounts at
      // path "/" (key `api:<id>/:<query>`) and the badge at "/unread-count".
      // Do NOT clear `api:<id>:*` broadly: that would wipe the user's entire
      // API cache (posts, feed, conversations, communities) on every
      // notification create/delete.
      clearByPattern(`api:${recipientId}:/unread-count*`),
      clearByPattern(`api:${recipientId}:/:*`),
    ]);
  } catch (err: any) {
    logger.error("Error invalidating notification caches", { error: err?.message, recipientId });
  }
};

type NotificationType = "like" | "comment" | "follow" | "repost" | "save" | "mention" | "reaction" | "message" | "message_reply" | "glimpse_reaction" | "glimpse_reply" | "poll_vote" | "collab_invite" | "follow_request" | "daily_reward" | "streak_reminder" | "invite_accepted" | "profile_share" | "post_share" | "glimpse_share" | "comment_share";

/**
 * Maps a notification type to its per-category preference key (see the
 * EmailPreference `notificationPrefs` object). System notifications
 * (daily rewards, streak reminders) are always delivered.
 */
const NOTIFICATION_CATEGORY: Record<NotificationType, string> = {
  like: "likes",
  comment: "comments",
  comment_share: "comments",
  follow: "follows",
  follow_request: "follows",
  invite_accepted: "follows",
  mention: "mentions",
  message: "messages",
  message_reply: "messages",
  reaction: "messages",
  repost: "reposts",
  post_share: "reposts",
  profile_share: "reposts",
  glimpse_share: "reposts",
  save: "saves",
  poll_vote: "polls",
  glimpse_reaction: "glances",
  glimpse_reply: "glances",
  collab_invite: "collabs",
  daily_reward: "system",
  streak_reminder: "system",
};

/**
 * Whether a recipient has the category for this notification type enabled.
 * Missing preference documents default to enabled (all categories on), so
 * users who never touched the settings keep receiving everything.
 */
export const shouldNotifyCategory = async (
  recipientId: string,
  type: NotificationType,
): Promise<boolean> => {
  try {
    const category = NOTIFICATION_CATEGORY[type] || "system";
    if (category === "system") return true;
    const pref = await EmailPreference.findOne({ user: recipientId })
      .select("notificationPrefs")
      .lean();
    const np = pref?.notificationPrefs as
      | Record<string, boolean | undefined>
      | undefined;
    return np?.[category] !== false;
  } catch (err: any) {
    logger.error("shouldNotifyCategory check failed", {
      error: err?.message,
      recipientId,
    });
    return true;
  }
};

type NotificationParams = {
  recipient: string;
  sender: string;
  type: NotificationType;
  post?: string | null;
  comment?: string | null;
  glimpse?: string | null;
  user?: string | null;
};

type CreateNotificationParams = NotificationParams;
type DeleteNotificationParams = NotificationParams;

export const extractMentions = async (text: string): Promise<string[]> => {
  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];
  const usernames = matches.map(match => match[1]?.toLowerCase() || "").filter(Boolean);

  if (usernames.length === 0) return [];

  const users = await User.find({ username: { $in: usernames } }).select("_id").lean();
  return users.map((user: any) => user._id.toString());
};

export const createNotification = async ({
  recipient,
  sender,
  type,
  post,
  comment,
  glimpse,
  user,
}: CreateNotificationParams) => {
  try {
    // prevent self notifications
    if (recipient.toString() === sender.toString()) {
      return null;
    }

    // Blocked users must never surface to each other — no in-app
    // notification, no socket event, no device push (either direction).
    if (await areMutuallyBlocked(recipient.toString(), sender.toString())) {
      return null;
    }

    // Per-category preference toggle — when the recipient disabled this
    // category, skip the in-app notification AND the device push entirely.
    if (!(await shouldNotifyCategory(recipient.toString(), type))) {
      return null;
    }

    // notifications
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      post: post || null,
      comment: comment || null,
      glimpse: glimpse || null,
      user: user || null,
    });

    // Invalidate the recipient's cached list + unread count so the badge
    // updates immediately instead of waiting for the cache TTL to expire.
    await invalidateRecipientNotificationCaches(recipient.toString());

    // populate notification for socket
    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", "fullName username profilePic")
      .populate("user", "fullName username profilePic")
      .lean();

    if (populatedNotification) {
      sendNotification(recipient.toString(), populatedNotification);

      // Also send device push notification (fire-and-forget). The unread
      // count is included so the service worker can update the launcher
      // badge (Android) — like real social apps.
      let unreadCount = 0;
      try {
        unreadCount = await Notification.countDocuments({
          recipient,
          isRead: false,
        });
      } catch (err: any) {
        logger.error("Failed to count unread notifications for push badge", {
          error: err.message,
        });
      }
      const pushPayload = buildPushPayload(populatedNotification, {
        unreadCount,
      });
      sendPushToUser(recipient.toString(), pushPayload);
    }

    return notification;
  } catch (err: any) {
    logger.error(`Error in createNotification utility!`, { error: err.message });

    return null;
  }
};

export const deleteInteractionNotification = async ({
  recipient,
  sender,
  type,
  post,
  comment,
  glimpse,
  user,
}: DeleteNotificationParams) => {
  try {
    const filter: Record<string, unknown> = {
      recipient,
      sender,
      type,
    };

    if (post !== undefined) {
      filter.post = post;
    }

    if (comment !== undefined) {
      filter.comment = comment;
    }

    if (glimpse !== undefined) {
      filter.glimpse = glimpse;
    }

    if (user !== undefined) {
      filter.user = user;
    }

    await Notification.deleteMany(filter);

    // Invalidate the recipient's cached list + unread count so the badge
    // updates immediately after an interaction is undone (e.g. unlike).
    await invalidateRecipientNotificationCaches(recipient.toString());
  } catch (err: any) {
    logger.error(`Error in deleteInteractionNotification utility!`, { error: err.message });
  }
};
