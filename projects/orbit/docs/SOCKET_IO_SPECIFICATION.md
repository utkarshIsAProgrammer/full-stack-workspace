# WebSocket Socket.io Event Specification

This document details the Socket.io real-time layer rules, detailing bidirectional message contracts, payload parameters, and instructions on synchronizing client states.

---

## 🔌 1. Socket.io Client Connection Setup

Initialize the socket client with proper cross-origin credentials configuration:

```typescript
import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

export const socket = io(socketUrl, {
  withCredentials: true,
  autoConnect: false, // Connect explicitly post user login
  transports: ["websocket"] // Avoid HTTP long-polling fallback for speed
});
```

---

## 📤 2. Client-to-Server Events (Emitters)

The client must emit the following socket events to inform the server of actions:

### A. Conversation Rooms: `chat:join` & `chat:leave`
Instruct the socket server to join/leave specific conversation channels. Room join is necessary to target direct messaging correctly.
```typescript
// Join Conversation View
socket.emit("chat:join", { conversationId: "654cda836a992bc" });

// Exit Conversation View
socket.emit("chat:leave", { conversationId: "654cda836a992bc" });
```

### B. Typing Indicators: `chat:typing`
Inform active room participants that the current user is typing.
- **Parameters:**
  - `conversationId`: String
  - `isTyping`: Boolean
```typescript
// On input character entry
socket.emit("chat:typing", { conversationId: "654cda836a992bc", isTyping: true });

// On input focus exit or typing delay > 2.5s
socket.emit("chat:typing", { conversationId: "654cda836a992bc", isTyping: false });
```

---

## 📥 3. Server-to-Client Events (Listeners)

The frontend must implement global and context-specific listeners to update state dynamically:

### A. Real-Time Chat Updates
- **`message:new`:** Triggered when a new direct message is sent to a conversation.
  - **Payload:**
    ```json
    {
      "_id": "message_id",
      "content": "Live message text",
      "sender": { "_id": "user_id", "username": "sender_user" },
      "conversation": "conversation_id",
      "files": [],
      "createdAt": "2026-06-11T20:30:00.000Z"
    }
    ```
- **`messages:seen`:** Triggered when recipient views messages in the chat window. Marks unread indicators as read on UI.
  - **Payload:** `{ conversationId: "id", userId: "id" }`
- **`message:edit` / `message:delete`:** Update message arrays by mutating or marking the targeted message as deleted.
- **`message:reaction`:** Emoji added or removed from a chat bubble.
  - **Payload:** `{ messageId: "id", reaction: { emoji: "🔥", sender: "user_id" }, type: "add" | "remove" }`

### B. Live Presence Tracking
- **`user:presence`:** Broadcaster informing when followed contacts sign in or out.
  - **Payload:** `{ userId: "id", online: boolean, lastSeen: DateString }`
  - **UI Integration:** Render a green glow dot on avatars where `online === true`. Otherwise, display relative time (e.g. *Last seen 2h ago*).

### C. Live Social Interactions
- **`post:like` / `post:unlike`:** Triggered when other users react to a post.
  - **Payload:** `{ postId: "id", userId: "id", likesCount: number }`
  - **Handling:** Update matching post details in the feed list. Skip processing if the local user is the action source (prevent double-counting).
- **`post:created` / `post:deleted`:** Broadcasts for new post publishing and removals.
  - **`post:created` payload:** Full `Post` object.
  - **Action:** Prepend the post if the logged-in user follows the post author, notifying via a top feed ribbon.
- **`comment:reply` / `comment:deleted`:** Triggered inside active post comment overlays to keep threading synchronized.

---

## 🧠 4. Frontend State Sync Guidelines

Implement a React `SocketProvider` wrapping the root component:

1. **Context Orchestration:** Instantiate connection on successful login. Terminate/disconnect on logout to free resources and update presence server-side.
2. **Dynamic Reducers / Event Dispatchers:**
   - Instead of routing all listener logic into local page states, use a custom event bus system or state dispatchers.
   - Example utilizing custom DOM events:
     ```typescript
     socket.on("post:like", (data) => {
       window.dispatchEvent(new CustomEvent("postInteractionChanged", {
         detail: { postId: data.postId, type: "like", value: true, source: "socket", count: data.likesCount }
       }));
     });
     ```
   - Listeners in feed components trap these events, matching IDs and setting values using React state modifiers.
3. **Deduplication:** When receiving items in real-time (such as posts or messages), verify if `_id` matches any existing item in arrays before appending, preventing layout shifts.
