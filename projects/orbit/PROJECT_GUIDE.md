# Orbit — Full Project Guide & Onboarding Manual

Welcome to **Orbit**!

This guide is written specifically for developers of all backgrounds. Whether you have **zero frontend experience** or **basic backend knowledge**, this document will walk you through how Orbit works, teach you the core principles of our technology stack, and help you trace real-time data flows step-by-step.

---

## 1. High-Level Architecture

Orbit is a real-time social platform split into two main sections:

1. **Frontend (`orbit-client`)**: The user interface running in the user's browser. Built with **React**, compiled with **Vite**, and styled with **Tailwind CSS**.
2. **Backend (`orbit-server`)**: The application server running in **Node.js** using the **Express** framework. It connects to **MongoDB** (database), **Redis** (caching and active sessions), and **Socket.io** (real-time connections).

```
┌──────────────────────────────────────┐
│           USER'S BROWSER             │
│        (React / orbit-client)        │
└──────────┬─────────────────▲─────────┘
           │                 │
    HTTP / REST API      WebSocket
  (apiFetch calls)     (Socket.io)
           │                 │
┌──────────▼─────────────────┴─────────┐
│         APPLICATION SERVER           │
│       (Express / orbit-server)       │
└──────────┬──────────┬──────┬─────────┘
           │          │      │
    Mongoose          │      └─────────────────┐
           │       Redis API                   │
┌──────────▼──┐  ┌────▼──────────────┐  ┌──────▼────────┐
│  MongoDB    │  │ Redis (Upstash)   │  │  Cloudinary   │
│  (Database) │  │ (Cache/Sessions)  │  │ (Image CDN)   │
└─────────────┘  └───────────────────┘  └───────────────┘
```

---

## 2. Frontend Crash Course (For Complete Beginners)

If you have never touched modern frontend development or **React**, this section will explain the key concepts you need to know to read and edit the code inside `orbit-client`.

### What is React?

In traditional websites, if you click a button or change content, the browser has to request a new page and reload the whole screen.
**React** allows us to build a **Single Page Application (SPA)**. The browser loads a single lightweight HTML page once. After that, React uses Javascript to update parts of the page dynamically without ever reloading the browser.

### A. React Components

A **Component** is a reusable, self-contained building block of the user interface. Think of it like a custom Lego brick. A component can contain structure (HTML), styles (CSS), and logic (JS).

- Example: [GlassCard.tsx](file:///home/indiedev/Develooper/SDE/production/orbit-client/src/components/GlassCard.tsx) is a reusable box with a beautiful "liquid glass" background. We use it all over the app to wrap other UI sections like post cards, login boxes, and notifications.

### B. Understanding JSX

React uses **JSX** (JavaScript XML), which lets us write HTML-like structure directly inside JavaScript code.

```jsx
// This is JSX inside a component
function WelcomeCard({ username }) {
  return (
    <div className="bg-zinc-950 p-4 rounded-xl">
      <h1>Welcome back, {username}!</h1>
    </div>
  );
}
```

_Notice how we can insert JavaScript variables directly into the HTML using curly braces `{}`!_

### C. State (`useState`)

In React, **State** is a special object or variable that holds data that might change over time. When state changes, React **re-renders** (redraws) the component on the screen automatically to display the updated data.

```typescript
import { useState } from "react";

function Counter() {
  // 1. Declare state variable 'count', and function 'setCount' to change it
  // 2. The default value is 0
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

### D. Effects (`useEffect`)

A component's primary job is to render the UI. Anything that happens _outside_ of rendering (like fetching data from a database, starting a timer, or connecting to a WebSocket) is called a **Side Effect**.
We use the `useEffect` hook to run code when:

1. The component first appears on screen (**Mounting**).
2. Certain variables change.
3. The component disappears from the screen (**Unmounting** / Clean-up).

Example of starting a real-time socket connection when the app starts:

```typescript
useEffect(() => {
  // This runs once when the component is created
  const socket = connectToSocket();

  // Clean-up function: runs when the component is destroyed
  return () => {
    socket.disconnect();
  };
}, []); // Empty brackets [] mean: "only run on mount and unmount"
```

### E. Refs (`useRef`)

Sometimes you need to interact directly with a physical browser element (e.g. telling a scrollbar to scroll to the bottom, or playing a video). A **Ref** is a reference to a DOM element.

- **Why it's used in Chat**: In [Chat.tsx](file:///home/indiedev/Develooper/SDE/production/orbit-client/src/components/Chat.tsx), whenever a new message arrives, we use a ref (`messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })`) to push the scroll container down so the user sees the new text.

### F. Props vs. Custom Events

- **Props (Properties)**: Used to pass data down from parent to child components.
  - _Example_: `App.tsx` has the list of online users. It passes this list down to `Dock.tsx` as a prop: `<Dock onlineUsers={onlineUsers} />`.
- **Custom Events**: If you have two components far apart in the project tree that need to talk, passing props through every intermediate component ("prop drilling") is slow and messy. Instead, Orbit uses custom browser events:
  - Component A dispatches an event: `window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId, action: "like" } }))`.
  - Component B listens for it: `window.addEventListener("postInteractionChanged", callback)`. This allows instant updates across different feeds or profile pages!

### G. Tailwind CSS & Glassmorphism

We style Orbit using **Tailwind CSS**, a utility-first styling system. Instead of writing custom CSS rules in separate files, you add utility classes directly to the elements.

- `flex items-center justify-between`: Creates a horizontal layout (flexbox), aligns children vertically to the center, and spreads them to opposite edges.
- `grid grid-cols-1 md:grid-cols-3`: Shows 1 column on small screens (like phones) and automatically shifts to 3 columns on medium screens and up (`md:`).
- `backdrop-blur-lg bg-zinc-950/50 border border-white/10`: Creates the **glassmorphism** aesthetic — blurs whatever is behind the card, applies a 50% transparent dark background, and draws a subtle glowing border.

### H. The API Client Wrapper ([api.ts](file:///home/indiedev/Develooper/SDE/production/orbit-client/src/utils/api.ts))

Rather than calling standard `fetch()`, we use a custom `apiFetch` helper. This helper automates several crucial tasks:

1. **Credentials**: Adds `credentials: "include"` to all requests. This forces the browser to send cookies (which store our authorization token) back to the backend.
2. **Double-Submit CSRF Protection**: Extracts the `csrf-token` cookie and sends it as an `x-csrf-token` header on any POST/PUT/DELETE request. The server verifies this match to block unauthorized cross-site requests.
3. **Response Caching**: If you make multiple GET requests to the same endpoint (like fetching a profile or a post), `apiFetch` stores the result in an in-memory `Map` cache. If you request the same resource again within its Time-To-Live (TTL, e.g. 15-30 seconds), the client uses the cached data instantly instead of hitting the server again.
4. **Cache Invalidation**: Whenever you do a state-changing operation (like posting, liking, or commenting), `apiFetch` automatically clears relevant entries in the cache so your next page view returns fresh data.

---

## 3. Backend Crash Course (For Beginners)

This section helps developers with basic backend understanding master how `orbit-server` is structured and handles requests.

### A. Routes, Middlewares, and Controllers

The Express backend routes requests through a predictable pipe:

```
Request from Client ──► Route Handler ──► Middleware(s) ──► Controller ──► Database ──► Response
```

1. **Routes** ([routes/](file:///home/indiedev/Develooper/SDE/production/orbit-server/src/routes)): Define the URLs and HTTP methods the server responds to.
   - _Example_: `router.post("/post/:postId", protect, togglePostLikes)` defines a POST endpoint to like a post.
2. **Middlewares** ([middlewares/](file:///home/indiedev/Develooper/SDE/production/orbit-server/src/middlewares)): Gatekeepers that check or mutate the incoming request _before_ it gets to the controller.
   - [auth.middleware.ts](file:///home/indiedev/Develooper/SDE/production/orbit-server/src/middlewares/auth.middleware.ts) (`protect`): Reads the JWT token from the HTTP cookie, decrypts it, verifies it, finds the user in MongoDB, and attaches them to `req.user`. If anything is invalid, it intercepts the request and returns `401 Unauthorized` instantly.
   - [ratelimit.middleware.ts](file:///home/indiedev/Develooper/SDE/production/orbit-server/src/middlewares/ratelimit.middleware.ts): Throttles abusive requests (e.g. maximum 5 login attempts per 15 minutes).
3. **Controllers** ([controllers/](file:///home/indiedev/Develooper/SDE/production/orbit-server/src/controllers)): The core javascript files containing business logic. They run database queries, construct real-time notifications, handle file configurations, and output JSON.

### B. MongoDB & Mongoose

We use **MongoDB** (a document-based NoSQL database) via the **Mongoose** library.

- **Document model**: Social media objects change shape (some posts have images, others have hashtags, others have comments). Document databases store data as JSON-like documents, making them ideal for this flexibility.
- **Relationships (`ObjectId`)**: Instead of storing all comments directly inside a post document, we store comments as their own collection and reference them by referencing the post ID:
  ```typescript
  // comment.model.ts schema field
  post: { type: Schema.Types.ObjectId, ref: "Post", required: true }
  ```
- **Population**: When you query comments, they initially only contain the sender's raw database ID. Mongoose's `.populate("sender", "username fullName profilePic")` joins the collections and substitutes that ID with the actual sender's details before sending it to the client.
- **Compound Indexes**: Speed up lookups. For instance, to check if a user has liked a post, we search the `Like` collection. We have an index `{ user: 1, post: 1 }` with `unique: true` to make search ultra-fast and guarantee a user can never like the same post twice.

### C. Redis Caching

Even though MongoDB is fast, reading feeds or search results repeatedly is resource-intensive. We use **Upstash Redis** (an ultra-fast, in-memory cache) to store copies of database responses.

1. **Cache Lookups**: Before querying MongoDB for posts, the server checks if the cache key (e.g., `cache:posts:all`) exists in Redis. If yes, it returns it instantly.
2. **Cache Miss**: If not found in Redis, the server queries MongoDB, saves the output to Redis with a Time-To-Live (TTL) expiration, and returns the data.
3. **Graceful Degradation**: If the Redis server experiences down-time, Orbit's error handler intercepts the failure silently, bypasses caching, and queries MongoDB directly so the website never crashes.

### D. Socket.io (Real-Time Bidirectional Communication)

HTTP requests are one-way: the client asks, the server replies. For features like typing indicators or instant chat, we use **WebSockets** via **Socket.io**.

- **Handshake Authentication**: When the browser connects to Socket.io, it sends the HTTP cookie. The socket connection is verified using the same security method as standard HTTP requests.
- **Rooms**: Think of rooms as temporary chat channels.
  - When a user logs in, they join a private room matching their ID: `user:userId`. When someone likes their post, the server emits a notification specifically to that user's private room.
  - When a user opens a chat, they join a conversation room: `conversation:convId`. Messages, read receipts, and typing indicators are broadcast only to members of that specific room.

---

## 4. End-to-End Tracing (Line-by-Line Flow)

Let’s trace exactly what happens under the hood during key application workflows.

### Trace A: The User Login Flow

How a user goes from typing their credentials to establishing a real-time web session:

```
[Client App]                                                                    [Express Server]
     │                                                                                 │
     │ 1. User submits login form (username + password)                                │
     ├────────────────────────────────────────────────────────────────────────────────►│
     │                                                                                 │ 2. Router checks [auth.routes.ts]
     │                                                                                 │    Runs [ratelimit.middleware.ts]
     │                                                                                 │    Calls login controller [auth.controllers.ts]
     │                                                                                 │
     │                                                                                 │ 3. Controller checks DB for username
     │                                                                                 │    Compares password via bcrypt.compare()
     │                                                                                 │    Generates a secure JWT token
     │                                                                                 │
     │                                                                                 │ 4. Sets JWT as HttpOnly Cookie (secure, no JS access)
     │                                                                                 │    Sets CSRF Token cookie (accessible to client JS)
     │                                                                                 │
     │ 5. Server responds with 200 OK + User profile JSON                              │
     │◄────────────────────────────────────────────────────────────────────────────────┤
     │                                                                                 │
     │ 6. App.tsx receives user details, sets global state                             │
     │                                                                                 │
     │ 7. App.tsx opens WebSocket connection (Socket.io)                               │
     │    Sends JWT cookie automatically with the handshake request                     │
     ├────────────────────────────────────────────────────────────────────────────────►│
     │                                                                                 │ 8. Server parses handshake cookie, verifies JWT
     │                                                                                 │    Saves connection, joins user room: "user:{userId}"
     │                                                                                 │    Broadcasts online status to followers
     │                                                                                 │
     └                                                                                 └
```

---

### Trace B: Sending and Receiving a Chat Message

How a message goes from one user's typing field to another's inbox in milliseconds:

```
[Sender Client]                    [Socket.io / Server]                  [Recipient Client]
       │                                     │                                    │
       │ 1. Sender clicks "Send"             │                                    │
       │    Emits socket event "chat:send"   │                                    │
       │    with (recipientId, text)         │                                    │
       ├────────────────────────────────────►│                                    │
       │                                     │ 2. Socket handler intercepts event │
       │                                     │    Retrieves sender from socket    │
       │                                     │    connection details              │
       │                                     │                                    │
       │                                     │ 3. Mongoose saves Message doc      │
       │                                     │    in MongoDB                      │
       │                                     │                                    │
       │                                     │ 4. Server broadcasts               │
       │                                     │    "message:new" event             │
       │                                     │    to conversation room            │
       │                                     │    and user room: "user:{recId}"   │
       │                                     ├───────────────────────────────────►│
       │                                     │                                    │ 5. Recipient listens for
       │                                     │                                    │    "message:new" event
       │                                     │                                    │    Appends message to array
       │                                     │                                    │    Triggers re-render
       │                                     │                                    │
       │                                     │                                    │ 6. Ref auto-scrolls chat window
       │                                     │                                    │    to bottom of view
       │                                     │                                    │
       └                                     └                                    └
```

---

### Trace C: Adding an Emoji Reaction to a Message (Instantly!)

Let's trace how chat message reactions work in Orbit. The goal is to update the database, notify the recipient, and make sure **both** users see the reaction change on their screens instantly without reloading the page.

#### Step 1: Frontend Interaction

In [Chat.tsx](file:///home/indiedev/Develooper/SDE/production/orbit-client/src/components/Chat.tsx), the user hovers over a message and clicks an emoji reaction (e.g., ❤️).
The client calls `toggleMessageReaction(messageId, emoji)`:

```typescript
const toggleMessageReaction = async (messageId: string, emoji: string) => {
  // 1. Optimistic Update: Add or modify reaction locally in client state first
  // so the user experiences zero lag.
  updateLocalMessageReactions(messageId, emoji, currentUser);

  try {
    // 2. Make API call to the server
    const res = await apiFetch(`/api/chat/react/${messageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });

    if (!res.ok) throw new Error("Reaction failed");
  } catch (err) {
    // 3. Rollback: If API fails, remove the optimistic reaction so client is in sync
    rollbackLocalMessageReactions(messageId, emoji, currentUser);
  }
};
```

#### Step 2: Backend Handling ([reaction.controllers.ts](file:///home/indiedev/Develooper/SDE/production/orbit-server/src/controllers/reaction.controllers.ts))

The server receives the POST request on the route `/api/chat/react/:messageId`. Let's step line-by-line through the `toggleReaction` controller:

1. **Extraction**: The server reads `messageId` from `req.params`, `emoji` from `req.body`, and the validated sender's ID from `req.user._id` (attached by `protect` middleware).
2. **Lookup**: Queries MongoDB for the message using `Message.findById(messageId)`.
3. **Toggle Logic**:
   - _If the user has already reacted with the exact same emoji_: The server assumes the user wants to remove it. It removes (splices) the reaction from the array. Sets `type = "remove"`.
   - _If the user has a different emoji reaction on this message_: The server removes that old reaction first, then creates a new reaction object: `{ emoji, sender: currentUserId, createdAt: new Date() }` and pushes it to the message's `reactions` array. Sets `type = "add"`.
4. **Save**: Saves the updated document to MongoDB: `await message.save()`.
5. **Populate details**: The server queries the message again and populates the reaction sender's info (so we have username and profile picture details for the UI).
6. **Socket Broadcast**: The server calls the socket helper:
   ```typescript
   emitMessageReaction(conversationId, {
     messageId,
     reaction: populatedReaction,
     type,
   });
   ```
   This immediately broadcasts the reaction update to everyone currently inside that chat conversation room.
7. **Notify Recipient**: If a reaction was _added_, the server generates a system notification in MongoDB and sends it over the socket to the recipient's private user room:
   ```typescript
   await createNotification({
     recipient: otherUser,
     sender: currentUserId,
     type: "reaction",
   });
   ```

#### Step 3: Real-Time UI Sync

Both the sender and recipient are listening for Socket.io events. Inside [Chat.tsx](file:///home/indiedev/Develooper/SDE/production/orbit-client/src/components/Chat.tsx):

```typescript
useEffect(() => {
  // Listen for real-time reaction changes broadcast by the server
  socket.on("message:reaction", ({ messageId, reaction, type }) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg._id !== messageId) return msg;

        let updatedReactions = [...(msg.reactions || [])];
        if (type === "add") {
          // Remove any existing reaction from this sender first (to avoid duplicates)
          updatedReactions = updatedReactions.filter(
            (r) => r.sender._id.toString() !== reaction.sender._id.toString(),
          );
          // Add the new reaction
          updatedReactions.push(reaction);
        } else if (type === "remove") {
          // Remove the reaction matching this sender and emoji
          updatedReactions = updatedReactions.filter(
            (r) =>
              !(
                r.sender._id.toString() === reaction.sender._id.toString() &&
                r.emoji === reaction.emoji
              ),
          );
        }

        return { ...msg, reactions: updatedReactions };
      }),
    );
  });

  return () => {
    socket.off("message:reaction");
  };
}, [socket]);
```

- **Result**: Because the component maps over `prevMessages` and updates the state variable `messages`, React immediately detects the state change and re-renders the chat bubbles. The emoji appears/disappears on the UI instantly without reloading!

---

## 5. How to Run & Debug (A Guide for Beginners)

To spin up this project locally on your machine, follow these instructions step-by-step.

### Prerequisite Checklist

Make sure you have installed:

- **Node.js** (v18 or higher is recommended).
- **Git** (for version control).
- A free **MongoDB Atlas** account (or local MongoDB Community Edition installed).
- A free **Upstash Redis** database (or local Redis server).
- A free **Cloudinary** account (for image hosting).

---

### Step 1: Set Up the Backend Environment

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd orbit-server
   ```
2. Copy the example environment template to create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
3. Open the newly created `.env` file in your code editor and fill in the values:
   - **`MONGO_URI`**: Paste your MongoDB connection string (e.g. `mongodb+srv://...` from MongoDB Atlas).
   - **`UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`**: Copy these details from your Upstash console.
   - **`CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`**: Copy these details from your Cloudinary dashboard settings.
   - **`CLIENT_URL`**: Set to `http://localhost:5173` (this is Vite's default dev server address, allowing the server to accept requests from our client).
   - **`JWT_SECRET`**: Type a long, random string to secure user authorization.

---

### Step 2: Start the Backend Server

1. Install the backend dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   You should see:

```text
[server]: Server is running at http://localhost:5000
[database]: Connected to MongoDB successfully.
[redis]: Connected to Redis cache.
```

---

### Step 3: Set Up and Start the Frontend Client

1. Open a new terminal tab or window and navigate to the frontend folder:
   ```bash
   cd orbit-client
   ```
2. Copy the client environment template:
   ```bash
   cp .env.example .env
   ```
3. Open the `.env` file and make sure it has the backend target:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
4. Install client dependencies:
   ```bash
   npm install
   ```
5. Start Vite's development server:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to the link shown (usually **`http://localhost:5173`**). The Orbit landing page should load!

---

## 6. Common Development Issues & How to Fix Them

Here are the most common issues beginners encounter and how to troubleshoot them.

### 1. CORS Errors (Cross-Origin Resource Sharing)

- **Symptoms**: The frontend console shows errors containing words like `Blocked by CORS policy` or `Access-Control-Allow-Origin header is missing`.
- **Why it happens**: For security, browsers prevent frontend pages on one address (`localhost:5173`) from requesting data from a different address (`localhost:5000`) unless the server explicitly allows it.
- **How to fix**: Check your backend `.env` file. Ensure `CLIENT_URL` is set to the _exact_ URL of your frontend (e.g., `http://localhost:5173`, with no trailing slash `/`).

### 2. Cookies are Not Saving / Auth Fails Instantly

- **Symptoms**: You log in successfully and receive a profile JSON response, but clicking any other tab results in `401 Unauthorized` errors, or the backend says no token is present.
- **Why it happens**: The backend stores the JWT in a cookie. If the frontend forgets to send that cookie, the backend doesn't know who you are.
- **How to fix**: Ensure any API call on the frontend uses our custom `apiFetch` wrapper. It automatically adds `credentials: "include"` which tells the browser to include cookies in the API request.

### 3. Socket.io Connection Fails

- **Symptoms**: Messages are not sent/received instantly, or you see continuous polling errors in your browser console console (`GET http://localhost:5000/socket.io/... 404`).
- **How to fix**: Ensure the backend server is running and configured correctly. In your browser console, check if the client is connecting to the correct port (matching `VITE_API_URL`).

### 4. Redis Connection Error

- **Symptoms**: Backend crashes with errors like `UPSTASH_REDIS_REST_URL is required` or cache requests timeout.
- **How to fix**: Open your backend `.env` and verify that the keys are named _exactly_ `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Avoid spaces or quotes around the values unless necessary.

---

## 7. Folder and File Guide

Here is a quick look at where to find files when you want to add features:

```text
orbit-client/src/
│
├── App.tsx             ◄── The orchestrator. Defines pages/tabs, tracks the logged-in user, and sets up socket events.
├── index.css           ◄── Global styles, custom scrollbar styling, and Tailwind design variables.
│
├── components/         ◄── Single UI modules.
│   ├── Feed.tsx        ◄── The main timeline feed. Shows, creates, and streams new posts.
│   ├── Chat.tsx        ◄── The real-time messaging interface (messages, typing states, reactions).
│   ├── Profile.tsx     ◄── Displays a user's profile card, banners, posts, saves, and following metrics.
│   ├── Auth.tsx        ◄── Login, Signup, and OTP forms.
│   └── GlassCard.tsx   ◄── The custom UI frame providing Orbit's core glassmorphic look.
│
└── utils/
    └── api.ts          ◄── Custom wrapper handling fetch requests, token sending, and client caching.
```

```text
orbit-server/src/
│
├── server.ts           ◄── Starting script. Connects Express and opens Socket.io.
│
├── routes/             ◄── Defines API path names (e.g., /api/posts, /api/auth).
├── middlewares/        ◄── Verification checks (auth validation, rate limiters, upload configurations).
├── controllers/        ◄── Database and business logic handlers (processes inputs and saves to MongoDB/Redis).
├── models/             ◄── Database schemas defining document variables (User, Post, Message, Reaction).
└── configs/            ◄── Shared singletons (Cloudinary, Socket.io setup, Upstash Redis client).
```

You are now fully set up to read, debug, and write code for **Orbit**! Don't hesitate to inspect the files referenced above to see how these theories translate into real-world code.

---

## 8. Complete API Reference

This section documents all available API endpoints, their purposes, request/response formats, and authentication requirements.

### Authentication Endpoints

#### POST /api/auth/signup

Register a new user account.

**Request Body:**

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securePassword123",
  "fullName": "John Doe"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "_id": "user_id_here",
    "username": "johndoe",
    "email": "john@example.com",
    "fullName": "John Doe",
    "profilePic": null,
    "followersCount": 0,
    "followingCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Validation Rules:**

- Username: 3-30 characters, alphanumeric only
- Email: Valid email format
- Password: Minimum 8 characters
- FullName: 2-50 characters

#### POST /api/auth/login

Authenticate a user and create a session.

**Request Body:**

```json
{
  "username": "johndoe",
  "password": "securePassword123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "_id": "user_id_here",
    "username": "johndoe",
    "email": "john@example.com",
    "fullName": "John Doe",
    "profilePic": "https://cloudinary.com/image.jpg",
    "bannerImage": null,
    "bio": null,
    "followersCount": 150,
    "followingCount": 75,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Cookies Set:**

- `token`: JWT token (httpOnly, secure, sameSite=strict)
- `csrf-token`: CSRF token for request validation

**Rate Limit:** 20 requests per 15 minutes

#### POST /api/auth/logout

Terminate the user's session.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Cookies Cleared:**

- `token`
- `csrf-token`

### Post Endpoints

#### GET /api/posts

Retrieve paginated feed of posts.

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Posts per page (default: 20, max: 50)
- `userId`: Optional - filter by specific user

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "post_id_here",
      "title": "My First Post",
      "content": "Hello world!",
      "author": {
        "_id": "user_id_here",
        "username": "johndoe",
        "fullName": "John Doe",
        "profilePic": "https://cloudinary.com/image.jpg"
      },
      "images": [],
      "hashtags": ["hello", "world"],
      "likesCount": 42,
      "commentsCount": 15,
      "savesCount": 8,
      "repostsCount": 3,
      "viewsCount": 256,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Authentication:** Not required for public feed
**Rate Limit:** 100 requests per 15 minutes
**Cache:** 60 seconds TTL

#### POST /api/posts

Create a new post.

**Request Body:**

```json
{
  "title": "My New Post",
  "content": "This is the post content",
  "images": ["base64_encoded_image_1", "base64_encoded_image_2"],
  "hashtags": ["new", "post"]
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Post created successfully",
  "data": {
    "_id": "post_id_here",
    "title": "My New Post",
    "content": "This is the post content",
    "author": {
      "_id": "user_id_here",
      "username": "johndoe",
      "fullName": "John Doe"
    },
    "images": ["https://cloudinary.com/image1.jpg"],
    "hashtags": ["new", "post"],
    "likesCount": 0,
    "commentsCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Authentication:** Required
**Rate Limit:** 10 requests per minute
**Image Upload:** Max 5 images, 5MB each

#### PUT /api/posts/:postId

Update an existing post.

**Request Body:**

```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "hashtags": ["updated"]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Post updated successfully",
  "data": {
    "_id": "post_id_here",
    "title": "Updated Title",
    "content": "Updated content",
    "hashtags": ["updated"],
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

**Authentication:** Required (must be post author)
**Rate Limit:** 10 requests per minute

#### DELETE /api/posts/:postId

Delete a post.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

**Authentication:** Required (must be post author)
**Rate Limit:** 10 requests per minute

### Comment Endpoints

#### GET /api/comments/:postId

Retrieve comments for a post.

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Comments per page (default: 20)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "comment_id_here",
      "content": "Great post!",
      "author": {
        "_id": "user_id_here",
        "username": "janedoe",
        "fullName": "Jane Doe",
        "profilePic": "https://cloudinary.com/image.jpg"
      },
      "post": "post_id_here",
      "parentComment": null,
      "replies": [],
      "likesCount": 5,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Authentication:** Optional
**Rate Limit:** 30 requests per minute
**Cache:** 30 seconds TTL

#### POST /api/comments/:postId

Add a comment to a post.

**Request Body:**

```json
{
  "content": "This is a comment",
  "parentComment": "parent_comment_id_here"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "_id": "comment_id_here",
    "content": "This is a comment",
    "author": {
      "_id": "user_id_here",
      "username": "johndoe"
    },
    "post": "post_id_here",
    "likesCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Authentication:** Required
**Rate Limit:** 20 requests per minute

### User Endpoints

#### GET /api/users/:userId

Get user profile by ID.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "_id": "user_id_here",
    "username": "johndoe",
    "fullName": "John Doe",
    "email": "john@example.com",
    "profilePic": "https://cloudinary.com/image.jpg",
    "bannerImage": "https://cloudinary.com/banner.jpg",
    "bio": "Software developer",
    "website": "https://johndoe.com",
    "followersCount": 150,
    "followingCount": 75,
    "postsCount": 42,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Authentication:** Optional
**Rate Limit:** 30 requests per minute
**Cache:** 120 seconds TTL

#### PUT /api/users/update-profile

Update user profile.

**Request Body (multipart/form-data):**

```
fullName: John Doe
bio: Updated bio
website: https://updated.com
profilePic: (file)
bannerImage: (file)
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "user_id_here",
    "fullName": "John Doe",
    "bio": "Updated bio",
    "website": "https://updated.com",
    "profilePic": "https://cloudinary.com/new-image.jpg"
  }
}
```

**Authentication:** Required
**Rate Limit:** 10 requests per minute

#### DELETE /api/users/delete-account

Delete user account and all associated data.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Authentication:** Required
**Rate Limit:** 5 requests per hour

### Chat Endpoints

#### POST /api/chats/conversations

Get or create a conversation with another user.

**Request Body:**

```json
{
  "participantId": "other_user_id_here"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "_id": "conversation_id_here",
    "participants": ["user_id_here", "other_user_id_here"],
    "lastMessage": {
      "_id": "message_id_here",
      "content": "Hello!",
      "sender": "user_id_here",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "unreadCount": 0,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Authentication:** Required
**Rate Limit:** 30 requests per minute

#### GET /api/chats/conversations

Get all conversations for the current user.

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "conversation_id_here",
      "participants": [
        {
          "_id": "user_id_here",
          "username": "johndoe",
          "fullName": "John Doe",
          "profilePic": "https://cloudinary.com/image.jpg"
        }
      ],
      "lastMessage": {
        "_id": "message_id_here",
        "content": "Hello!",
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      "unreadCount": 2
    }
  ]
}
```

**Authentication:** Required
**Rate Limit:** 30 requests per minute
**Cache:** 30 seconds TTL

#### GET /api/chats/conversations/:conversationId/messages

Get messages for a conversation.

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Messages per page (default: 50)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "message_id_here",
      "content": "Hello!",
      "sender": {
        "_id": "user_id_here",
        "username": "johndoe",
        "fullName": "John Doe",
        "profilePic": "https://cloudinary.com/image.jpg"
      },
      "conversation": "conversation_id_here",
      "reactions": [
        {
          "emoji": "❤️",
          "sender": {
            "_id": "other_user_id_here",
            "username": "janedoe"
          },
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "isDeleted": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Authentication:** Required
**Rate Limit:** 30 requests per minute
**Cache:** 10 seconds TTL

#### POST /api/chats/conversations/:conversationId/messages

Send a message.

**Request Body (multipart/form-data):**

```
content: Hello!
files: (optional file attachments)
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "_id": "message_id_here",
    "content": "Hello!",
    "sender": "user_id_here",
    "conversation": "conversation_id_here",
    "files": [],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Authentication:** Required
**Rate Limit:** 30 requests per minute

### Interaction Endpoints

#### POST /api/likes/post/:postId

Toggle like on a post.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Post liked",
  "data": {
    "liked": true,
    "likesCount": 43
  }
}
```

**Authentication:** Required
**Rate Limit:** 30 requests per minute

#### POST /api/follows/:userId

Toggle follow on a user.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "User followed",
  "data": {
    "following": true,
    "followersCount": 151
  }
}
```

**Authentication:** Required
**Rate Limit:** 30 requests per minute

#### POST /api/saves/:postId

Toggle save on a post.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Post saved",
  "data": {
    "saved": true,
    "savesCount": 9
  }
}
```

**Authentication:** Required
**Rate Limit:** 30 requests per minute

### Search Endpoints

#### GET /api/search/users

Search for users by username or name.

**Query Parameters:**

- `q`: Search query
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "user_id_here",
      "username": "johndoe",
      "fullName": "John Doe",
      "profilePic": "https://cloudinary.com/image.jpg",
      "followersCount": 150
    }
  ]
}
```

**Authentication:** Optional
**Rate Limit:** 30 requests per minute
**Cache:** 60 seconds TTL

#### GET /api/search/posts

Search for posts by content or hashtags.

**Query Parameters:**

- `q`: Search query
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "post_id_here",
      "title": "Search Result Post",
      "content": "This post matches the search",
      "author": {
        "_id": "user_id_here",
        "username": "johndoe"
      },
      "likesCount": 25,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Authentication:** Optional
**Rate Limit:** 30 requests per minute
**Cache:** 60 seconds TTL

### Notification Endpoints

#### GET /api/notifications

Get notifications for the current user.

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Notifications per page (default: 20)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "notification_id_here",
      "type": "like",
      "content": "johndoe liked your post",
      "relatedId": "post_id_here",
      "sender": {
        "_id": "user_id_here",
        "username": "johndoe",
        "fullName": "John Doe",
        "profilePic": "https://cloudinary.com/image.jpg"
      },
      "read": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Authentication:** Required
**Rate Limit:** 30 requests per minute
**Cache:** 30 seconds TTL

#### PUT /api/notifications/read

Mark all notifications as read.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

**Authentication:** Required
**Rate Limit:** 10 requests per minute

---

## 9. Database Schema Documentation

### User Schema

```typescript
{
  _id: ObjectId,
  username: String (unique, required, 3-30 chars),
  email: String (unique, required),
  password: String (hashed with bcrypt),
  fullName: String (2-50 chars),
  profilePic: String (Cloudinary URL),
  bannerImage: String (Cloudinary URL),
  bio: String (max 500 chars),
  website: String (URL),
  followers: [ObjectId] (references User),
  following: [ObjectId] (references User),
  followersCount: Number (default: 0),
  followingCount: Number (default: 0),
  createdAt: Date (default: now),
  updatedAt: Date
}
```

**Indexes:**

- Unique index on `username`
- Unique index on `email`
- Compound index on `followersCount` and `createdAt`

### Post Schema

```typescript
{
  _id: ObjectId,
  title: String (required, max 200 chars),
  content: String (required, max 5000 chars),
  author: ObjectId (ref: User, required),
  images: [String] (Cloudinary URLs),
  hashtags: [String],
  slug: String (unique, auto-generated),
  likes: [ObjectId] (references User),
  saves: [ObjectId] (references User),
  reposts: [ObjectId] (references User),
  likesCount: Number (default: 0),
  savesCount: Number (default: 0),
  repostsCount: Number (default: 0),
  commentsCount: Number (default: 0),
  viewsCount: Number (default: 0),
  pinned: Boolean (default: false),
  createdAt: Date (default: now),
  updatedAt: Date
}
```

**Indexes:**

- Unique index on `slug`
- Compound index on `author` and `createdAt`
- Compound index on `hashtags` and `createdAt`
- Index on `pinned` status

### Comment Schema

```typescript
{
  _id: ObjectId,
  content: String (required, max 2000 chars),
  author: ObjectId (ref: User, required),
  post: ObjectId (ref: Post, required),
  parentComment: ObjectId (ref: Comment, optional),
  likes: [ObjectId] (references User),
  likesCount: Number (default: 0),
  replies: [ObjectId] (references Comment),
  createdAt: Date (default: now),
  updatedAt: Date
}
```

**Indexes:**

- Compound index on `post` and `createdAt`
- Compound index on `author` and `createdAt`
- Index on `parentComment`

### Message Schema

```typescript
{
  _id: ObjectId,
  content: String (required, max 5000 chars),
  sender: ObjectId (ref: User, required),
  recipient: ObjectId (ref: User, required),
  conversation: ObjectId (ref: Conversation, required),
  files: [String] (Cloudinary URLs),
  reactions: [{
    emoji: String,
    sender: ObjectId (ref: User),
    createdAt: Date
  }],
  isDeleted: Boolean (default: false),
  editedAt: Date (optional),
  createdAt: Date (default: now)
}
```

**Indexes:**

- Compound index on `conversation` and `createdAt`
- Compound index on `sender` and `createdAt`
- Compound index on `recipient` and `createdAt`
- Index on `isDeleted`

### Conversation Schema

```typescript
{
  _id: ObjectId,
  participants: [ObjectId] (references User, unique, required),
  lastMessage: ObjectId (ref: Message),
  unreadCount: Number (default: 0),
  createdAt: Date (default: now),
  updatedAt: Date (default: now)
}
```

**Indexes:**

- Unique compound index on `participants` (sorted)
- Index on `lastMessage`
- Index on `updatedAt`

---

## 10. Socket.io Events Reference

### Client-to-Server Events

#### chat:join

Join a conversation room.

```typescript
socket.emit("chat:join", { conversationId: "conv_id" });
```

#### chat:leave

Leave a conversation room.

```typescript
socket.emit("chat:leave", { conversationId: "conv_id" });
```

#### chat:typing

Send typing indicator.

```typescript
socket.emit("chat:typing", { conversationId: "conv_id", isTyping: true });
```

### Server-to-Client Events

#### notification

New notification received.

```typescript
socket.on("notification", (notification) => {
  console.log("New notification:", notification);
  // { _id, type, content, sender, relatedId, read, createdAt }
});
```

#### message:new

New message received.

```typescript
socket.on("message:new", (message) => {
  console.log("New message:", message);
  // { _id, content, sender, conversation, files, createdAt }
});
```

#### message:edit

Message edited.

```typescript
socket.on("message:edit", (message) => {
  console.log("Message edited:", message);
  // { _id, content, editedAt }
});
```

#### message:delete

Message deleted.

```typescript
socket.on("message:delete", (messageId) => {
  console.log("Message deleted:", messageId);
});
```

#### message:reaction

Reaction added/removed.

```typescript
socket.on("message:reaction", (data) => {
  console.log("Reaction updated:", data);
  // { messageId, reaction, type }
});
```

#### messages:seen

Messages marked as read.

```typescript
socket.on("messages:seen", (data) => {
  console.log("Messages seen:", data);
  // { conversationId, userId }
});
```

#### user:presence

User online/offline status.

```typescript
socket.on("user:presence", (data) => {
  console.log("User presence:", data);
  // { userId, online, lastSeen }
});
```

#### post:like / post:unlike

Post like status changed.

```typescript
socket.on("post:like", (data) => {
  console.log("Post liked:", data);
  // { postId, userId, likesCount }
});
```

#### post:save / post:unsave

Post save status changed.

```typescript
socket.on("post:save", (data) => {
  console.log("Post saved:", data);
  // { postId, userId, savesCount }
});
```

#### post:repost / post:unrepost

Post repost status changed.

```typescript
socket.on("post:repost", (data) => {
  console.log("Post reposted:", data);
  // { postId, userId, repostsCount }
});
```

#### post:created

New post created.

```typescript
socket.on("post:created", (post) => {
  console.log("New post:", post);
  // Full post object
});
```

#### post:deleted

Post deleted.

```typescript
socket.on("post:deleted", (postId) => {
  console.log("Post deleted:", postId);
});
```

#### comment:reply

New comment reply.

```typescript
socket.on("comment:reply", (comment) => {
  console.log("New comment:", comment);
  // Full comment object
});
```

#### comment:updated

Comment updated.

```typescript
socket.on("comment:updated", (comment) => {
  console.log("Comment updated:", comment);
  // Full comment object
});
```

#### comment:deleted

Comment deleted.

```typescript
socket.on("comment:deleted", (commentId) => {
  console.log("Comment deleted:", commentId);
});
```

---

## 11. Environment Variables Complete Reference

### Backend Environment Variables (.env)

```bash
# Server Configuration
PORT=5000
NODE_ENV=development  # or production

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/orbit

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Cloudinary (Image Storage)
CLOUDINARY_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@orbit.com

# Frontend URL (CORS)
CLIENT_URL=http://localhost:5173

# Socket.io (Production)
SOCKET_URL=https://your-domain.com
```

### Frontend Environment Variables (.env)

```bash
# API URL
VITE_API_URL=http://localhost:5000

# Socket.io URL (optional, defaults to API_URL)
VITE_SOCKET_URL=http://localhost:5000
```

---

## 12. Performance Optimization Guide

### Backend Optimizations Implemented

#### 1. Redis Caching Strategy

- **GET Endpoints**: All GET endpoints are cached with appropriate TTLs
- **Cache TTLs**:
  - Posts: 60 seconds
  - Users: 120 seconds
  - Comments: 30 seconds
  - Search: 60 seconds
  - Chat messages: 10 seconds
  - Conversations: 30 seconds
  - Notifications: 30 seconds
- **Cache Invalidation**: Automatic invalidation on mutations (POST, PUT, DELETE)

#### 2. Database Indexing

- **User Model**: Username, email, followersCount, followingCount, createdAt
- **Post Model**: Slug (unique), author+createdAt, hashtags+createdAt, pinned
- **Comment Model**: Post+createdAt, author+createdAt, parentComment
- **Message Model**: Conversation+createdAt, sender+createdAt, recipient+createdAt, isDeleted
- **Conversation Model**: Participants (unique compound), lastMessage, updatedAt

#### 3. Connection Pooling

- **MongoDB**: maxPoolSize=50, minPoolSize=5
- **Redis**: Connection reuse with retry logic

#### 4. Query Optimization

- **Lean Queries**: Use `.lean()` for read-only operations
- **Projection**: Select only needed fields
- **Population**: Batch populate to prevent N+1 queries
- **Compound Indexes**: Optimize common query patterns

#### 5. Response Compression

- Gzip compression enabled for all responses
- Reduces payload size by 60-80%

### Frontend Optimizations Implemented

#### 1. Client-Side Caching

- **API Cache**: In-memory Map cache with TTL
- **Cache TTLs**: 15-30 seconds per endpoint
- **Cache Invalidation**: Automatic on mutations

#### 2. Optimistic Updates

- **Interactions**: Like, save, repost update UI immediately
- **Rollback**: Revert on API failure

#### 3. Lazy Loading

- **Code Splitting**: React.lazy() for all tab components
- **Suspense**: Loading states during component load

#### 4. Image Optimization

- **Cloudinary**: Automatic image optimization
- **Lazy Loading**: Images load as needed
- **WebP Format**: Modern image format support

#### 5. Bundle Optimization

- **Tree Shaking**: Remove unused code
- **Code Splitting**: Separate chunks for routes
- **Minification**: Production builds are minified

---

## 13. Security Best Practices

### Backend Security

#### 1. Authentication

- **JWT Tokens**: HttpOnly, secure, sameSite=strict cookies
- **Password Hashing**: bcrypt with salt rounds
- **Token Expiration**: Configurable JWT expiration

#### 2. CSRF Protection

- **Double-Submit Cookie**: CSRF token in cookie and header
- **Header Validation**: Server validates CSRF token on mutations

#### 3. Rate Limiting

- **Per-Endpoint Limits**: Different limits for different endpoints
- **Redis-Based**: Distributed rate limiting
- **Brute Force Protection**: Login attempt limits

#### 4. Input Validation

- **Zod Schemas**: Strict validation on all inputs
- **SQL Injection Prevention**: Mongoose parameterized queries
- **XSS Prevention**: sanitize-html for user content

#### 5. Security Headers

- **Helmet**: Security headers (HSTS, X-Frame-Options, etc.)
- **CORS**: Configurable allowed origins
- **Content Security Policy**: CSP headers

### Frontend Security

#### 1. XSS Prevention

- **React**: Automatic XSS escaping
- **DOMPurify**: Sanitize HTML content
- **Content Security Policy**: CSP meta tags

#### 2. Secure Storage

- **HttpOnly Cookies**: Tokens stored in httpOnly cookies
- **No localStorage**: No sensitive data in localStorage

#### 3. HTTPS Only

- **Production**: HTTPS required
- **Secure Cookies**: Secure flag set in production

---

## 14. Deployment Guide

### Backend Deployment (Render/Heroku/Vercel)

#### 1. Prepare for Production

```bash
# Build the backend
cd orbit-server
npm run build

# Test the build
npm start
```

#### 2. Set Environment Variables

Configure all required environment variables in your hosting platform:

- MONGO_URI
- JWT_SECRET
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- CLOUDINARY_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- SMTP_HOST, SMTP_USER, SMTP_PASS
- CLIENT_URL (production domain)
- NODE_ENV=production

#### 3. Deploy

- **Render**: Connect GitHub repository, configure build command and start command
- **Heroku**: Create Procfile, push to Heroku
- **Vercel**: Configure as serverless function or container

#### 4. Post-Deployment

- Test health check endpoint
- Verify database connections
- Test authentication flow
- Test real-time features
- Monitor logs for errors

### Frontend Deployment (Vercel/Netlify)

#### 1. Prepare for Production

```bash
# Build the frontend
cd orbit-client
npm run build

# Test the build
npm run preview
```

#### 2. Set Environment Variables

- VITE_API_URL (production backend URL)

#### 3. Deploy

- **Vercel**: Connect GitHub repository, auto-deploy on push
- **Netlify**: Connect GitHub repository, configure build settings

#### 4. Post-Deployment

- Test all pages
- Test authentication
- Test real-time features
- Verify API connectivity

---

## 15. Testing Guide

### Backend Testing

#### Unit Tests

```bash
cd orbit-server
npm test
```

#### Integration Tests

- Test API endpoints
- Test database operations
- Test authentication flow
- Test real-time features

### Frontend Testing

#### Unit Tests

```bash
cd orbit-client
npm test
```

#### E2E Tests

- Test user flows
- Test authentication
- Test real-time features
- Test responsive design

---

## 16. Monitoring and Debugging

### Backend Monitoring

#### Health Check

```bash
curl https://your-domain.com/api/health
```

#### Performance Metrics

- API response times
- Database query times
- Cache hit rates
- Error rates

#### Logging

- Request logs with UUID
- Error logs with stack traces
- Performance metrics

### Frontend Monitoring

#### Browser DevTools

- Console for errors
- Network tab for API calls
- Performance tab for load times

#### Error Tracking

- Sentry integration for error tracking
- Performance monitoring

---

## 17. Contributing Guidelines

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Follow ESLint rules
- **Prettier**: Follow Prettier formatting
- **Naming**: camelCase for variables, PascalCase for components

### Git Workflow

1. Create feature branch from main
2. Make changes with descriptive commits
3. Test thoroughly
4. Create pull request
5. Code review
6. Merge to main

### Commit Message Format

```
type(scope): description

Examples:
feat(auth): add OAuth login
fix(chat): resolve message ordering bug
docs(readme): update installation guide
```

---

## 18. Troubleshooting Advanced Issues

### Database Connection Pool Exhaustion

**Symptoms**: Connection timeout errors, slow queries
**Solution**: Increase maxPoolSize, optimize queries, add connection timeout

### Memory Leaks

**Symptoms**: Increasing memory usage over time
**Solution**: Check for unclosed connections, monitor memory usage, restart server periodically

### Socket.io Connection Drops

**Symptoms**: Real-time features stop working
**Solution**: Check WebSocket configuration, verify firewall settings, implement reconnection logic

### Cache Stampede

**Symptoms**: High database load on cache expiration
**Solution**: Implement cache lock, use random expiration times, pre-warm cache

---

**You now have a complete understanding of the Orbit project!** 🚀
