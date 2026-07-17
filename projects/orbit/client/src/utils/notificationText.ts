import type { NotificationType } from "../types";

/**
 * Returns a human-readable notification message for a given notification type.
 * Used by both the floating in-app toast and native OS notifications.
 */
export const getNotificationText = (type: NotificationType): string => {
  switch (type) {
    case "like":
      return "liked your post!";
    case "comment":
      return "commented on your post!";
    case "follow":
      return "followed you!";
    case "repost":
      return "reposted your post!";
    case "save":
      return "bookmarked your post!";
    case "mention":
      return "mentioned you!";
    case "reaction":
      return "reacted to your comment!";
    case "message_reply":
      return "replied to your message!";
    case "glimpse_reaction":
      return "reacted to your glance!";
    case "glimpse_reply":
      return "replied to your glance!";
    default:
      return "interacted with you!";
  }
};

/**
 * Returns a more playful notification message for the in-app floating toast.
 */
export const getFloatingToastText = (type: NotificationType): string => {
  switch (type) {
    case "like":
      return "liked your status post!";
    case "comment":
      return "replied inside your comments list!";
    case "follow":
      return "followed your orbit profile!";
    case "repost":
      return "reposted your status post!";
    case "save":
      return "bookmarked your post!";
    case "mention":
      return "mentioned your handle index!";
    case "reaction":
      return "reacted to your comment!";
    case "message_reply":
      return "replied to your chat message!";
    case "glimpse_reaction":
      return "liked your glance!";
    case "glimpse_reply":
      return "responded to your glance!";
    default:
      return "joined your orbit!";
  }
};
