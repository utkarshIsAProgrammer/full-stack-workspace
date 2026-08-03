import type { NotificationType } from "../types";

/**
 * Returns a human-readable notification message for a given notification type.
 * Used by both the floating in-app toast and native OS notifications.
 */
export const getNotificationText = (type: NotificationType, senderName?: string): string => {
  const name = senderName || "Someone";
  switch (type) {
    case "like":
      return `${name} liked your post!`;
    case "comment":
      return `${name} commented on your post!`;
    case "follow":
      return `${name} followed you!`;
    case "repost":
      return `${name} reposted your post!`;
    case "save":
      return `${name} bookmarked your post!`;
    case "mention":
      return `${name} mentioned you!`;
    case "reaction":
      return `${name} reacted to your comment!`;
    case "message_reply":
      return `${name} replied to your message!`;
    case "glimpse_reaction":
      return `${name} reacted to your glance!`;
    case "glimpse_reply":
      return `${name} replied to your glance!`;
    case "community_message":
      return `${name} sent a message in a community!`;
    case "poll_vote":
      return `${name} voted in your poll!`;
    case "collab_invite":
      return `${name} invited you to collaborate on their post!`;
    case "invite_accepted":
      return `${name} accepted your collaboration invite!`;
    default:
      return `${name} interacted with you!`;
  }
};

/**
 * Returns a description of the message type for notification display.
 */
export const getMessageTypeLabel = (messageType?: string): string => {
  switch (messageType) {
    case "photo":
      return "sent a photo";
    case "video":
      return "sent a video";
    case "voice_note":
      return "sent a voice note";
    case "gif":
      return "sent a GIF";
    case "sticker":
      return "sent a sticker";
    case "file":
      return "sent a document";
    default:
      return "sent a message";
  }
};

/**
 * Returns a more playful notification message for the in-app floating toast.
 */
export const getFloatingToastText = (type: NotificationType): string => {
  switch (type) {
    case "like":
      return "liked your post!";
    case "comment":
      return "replied to your post!";
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
      return "liked your glance!";
    case "glimpse_reply":
      return "responded to your glance!";
    case "community_message":
      return "sent a message";
    case "poll_vote":
      return "voted in your poll!";
    case "collab_invite":
      return "invited you to collaborate!";
    case "invite_accepted":
      return "accepted your collab invite!";
    default:
      return "interacted with you!";
  }
};
