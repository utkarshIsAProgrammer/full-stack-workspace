import Notification from "../models/notification.model";

type NotificationType = "like" | "comment" | "follow" | "repost" | "save";

type NotificationParams = {
  recipient: string;
  sender: string;
  type: NotificationType;
  post?: string | null;
  comment?: string | null;
};

type CreateNotificationParams = NotificationParams;
type DeleteNotificationParams = NotificationParams;

export const createNotification = async ({
  recipient,
  sender,
  type,
  post,
  comment,
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
    });

    return notification;
  } catch (err: any) {
    console.log(`Error in createNotification utility! ${err.message}`);

    return null;
  }
};

export const deleteInteractionNotification = async ({
  recipient,
  sender,
  type,
  post,
  comment,
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

    await Notification.deleteMany(filter);
  } catch (err: any) {
    console.log(`Error in deleteInteractionNotification utility! ${err.message}`);
  }
};
