/**
 * Mock Socket.IO helpers for integration tests.
 *
 * In test mode, Socket.IO is never initialized (initSocket is never called),
 * so the real socket module's emit functions would crash on `io.to(...)`.
 * This mock replaces the real socket module with no-op versions of every
 * emit function so that controllers don't throw during tests.
 *
 * Usage (in jest.config.js setupFilesAfterSetup or in setup.ts):
 *   jest.mock("../configs/socket", () => require("./helpers/mockSocket"));
 */

// List of all emit functions from the real socket module
const emitFunctions = [
  "emitPostLike",
  "emitPostUnlike",
  "emitPostSave",
  "emitPostUnsave",
  "emitPostRepost",
  "emitPostUnrepost",
  "emitPostComment",
  "emitCommentReply",
  "emitCommentLike",
  "emitCommentUnlike",
  "emitPostCreated",
  "emitPostDeleted",
  "emitPostUpdated",
  "emitCommentUpdated",
  "emitCommentDeleted",
  "emitFollowUser",
  "emitUnfollowUser",
  "emitPostShare",
  "emitUserShare",
  "emitCommentReaction",
  "emitMessageReaction",
  "emitPostView",
  "emitUserView",
  "emitPostPin",
  "emitPostUnpin",
  "emitNewMessage",
  "emitMessageEdit",
  "emitMessageDelete",
  "emitMessageDeleteForMe",
  "emitChatNotification",
  "emitUserUpdated",
  "emitAccountDeleted",
  "sendNotification",
  "disconnectUserSockets",
];

const mock: Record<string, (...args: any[]) => void> = {};

for (const fn of emitFunctions) {
  mock[fn] = () => {};
}

// getIO throws if called in tests — tests shouldn't need it
mock.getIO = () => {
  throw new Error("Socket.IO is not initialized in test mode");
};

// Presence helpers return offline by default
mock.isRecipientActiveInConversation = async () => false;
mock.getUserPresenceStatus = async () => "offline";
mock.getUserPresenceStatuses = async () => ({});

// Socket init/shutdown are no-ops
mock.initSocket = async () => {};
mock.shutdownSocket = async () => {};

module.exports = mock;
