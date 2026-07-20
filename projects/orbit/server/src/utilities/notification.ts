import Notification from "../models/notification.model";
import { User } from "../models/user.model";
import { sendNotification } from "../configs/socket";
import { sendPushToUser, buildPushPayload } from "../services/pushService";
import { logger } from "./logger";

type NotificationType = "like" | "comment" | "follow" | "repost" | "save" | "mention" | "reaction" | "message_reply" | "glimpse_reaction" | "glimpse_reply" | "poll_vote" | "collab_invite" | "follow_request" | "daily_reward" | "streak_reminder" | "room_invite" | "invite_accepted";

type NotificationParams = {
  recipient: string;
  sender: string;
  type: NotificationType;
  post?: string | null;
  comment?: string | null;
  glimpse?: string | null;
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
}: CreateNotificationParams) => {
  try {
    // prevent self notifications
    if (recipient.toString() === sender.toString()) {
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
    });

    // populate notification for socket
    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", "fullName username profilePic")
      .lean();

    if (populatedNotification) {
      sendNotification(recipient.toString(), populatedNotification);

      // Also send device push notification (fire-and-forget)
      const pushPayload = buildPushPayload(populatedNotification);
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

    await Notification.deleteMany(filter);
  } catch (err: any) {
    logger.error(`Error in deleteInteractionNotification utility!`, { error: err.message });
  }
};
