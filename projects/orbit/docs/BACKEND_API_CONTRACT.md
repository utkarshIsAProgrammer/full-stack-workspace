# Backend REST API Contract

This document outlines the API route paths, HTTP methods, authorization levels, parameters, and request/response payloads supported by the Orbit backend. All API interactions must strictly adhere to these signatures.

---

## 🌐 1. Base URL and Request Headers

- **Base URL:** `http://localhost:5000` (Local) / Custom production server. Set dynamically using `VITE_API_URL`.
- **Credential Sharing:** All requests must pass cookies (`credentials: "include"` in fetch) to support secure JWT sessions.
- **CSRF Token:** Mutations (POST, PUT, DELETE) must include the `X-CSRF-Token` header. The token can be retrieved from cookies or from the auth initialization response.

---

## 🔑 2. Authentication Endpoints

### POST `/api/auth/signup`
Registers a new user profile.
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securePassword123",
    "fullName": "John Doe"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "_id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "fullName": "John Doe",
      "profilePic": null,
      "followersCount": 0,
      "followingCount": 0,
      "createdAt": "2026-06-11T20:00:00.000Z"
    }
  }
  ```

### POST `/api/auth/login`
Authenticates a user and registers an HttpOnly session cookie.
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "username": "johndoe",
    "password": "securePassword123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "_id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "fullName": "John Doe",
      "profilePic": "https://cloudinary.com/pic.jpg",
      "followersCount": 10,
      "followingCount": 15,
      "createdAt": "2026-06-11T20:00:00.000Z"
    }
  }
  ```

### POST `/api/auth/logout`
Destroys the active session.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

### GET `/api/auth/me`
Retrieves current session user details to resume login state on page refresh.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "_id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "fullName": "John Doe",
      "profilePic": "https://cloudinary.com/pic.jpg",
      "followersCount": 10,
      "followingCount": 15
    }
  }
  ```

---

## 📝 3. Post Endpoints

### GET `/api/posts`
Fetches a list of posts supporting cursor pagination.
- **Query Params:**
  - `limit` (default: 10)
  - `cursor` (optional, ID of the last fetched post)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "posts": [
      {
        "_id": "post_id",
        "title": "Welcome to Orbit",
        "content": "This is our new workspace #orbit",
        "author": {
          "_id": "author_id",
          "username": "creator",
          "fullName": "Creator User",
          "profilePic": "https://cloudinary.com/avatar.jpg"
        },
        "images": ["https://cloudinary.com/post-img.jpg"],
        "hashtags": ["orbit"],
        "slug": "welcome-to-orbit-random123",
        "likesCount": 15,
        "savesCount": 2,
        "repostsCount": 3,
        "commentsCount": 5,
        "likedByMe": true,
        "savedByMe": false,
        "repostedByMe": false,
        "createdAt": "2026-06-11T20:05:00.000Z"
      }
    ],
    "nextCursor": "post_id_of_last_item",
    "hasMore": true
  }
  ```

### POST `/api/posts`
Creates a post. Supports text and image attachments.
- **Headers:** `Content-Type: multipart/form-data`
- **Request Body (FormData):**
  - `title`: String (required, max 200 chars)
  - `content`: String (required, max 5000 chars)
  - `image`: File (optional, max 5 files, <= 5MB each)
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Post created successfully",
    "post": {
      "_id": "new_post_id",
      "title": "Stellar Post",
      "content": "Look at the stars!",
      "author": "user_id",
      "slug": "stellar-post-xyz",
      "createdAt": "2026-06-11T20:10:00.000Z"
    }
  }
  ```

---

## 💬 4. Comment Endpoints

### GET `/api/comments/:postId`
Fetch nested comments associated with a post.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "comment_id",
        "content": "Awesome features!",
        "author": {
          "_id": "commenter_id",
          "username": "commenter",
          "profilePic": "https://cloudinary.com/avatar.jpg"
        },
        "post": "post_id",
        "parentComment": null,
        "likesCount": 2,
        "repliesCount": 1,
        "reactions": [],
        "createdAt": "2026-06-11T20:06:00.000Z"
      }
    ]
  }
  ```

### POST `/api/comments/:postId`
Publishes a comment (or reply) on a post.
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "content": "This is a reply to the comment",
    "parentCommentId": "parent_comment_id" 
  }
  ```

---

## 👤 5. Profile & User Endpoints

### GET `/api/users/:userId`
Fetch a specific user's public info.

### PUT `/api/users/update-profile`
Updates bio details and handles avatar/banner image updates.
- **Headers:** `Content-Type: multipart/form-data`
- **Request Body (FormData):**
  - `fullName`: String (optional)
  - `bio`: String (optional, max 500 chars)
  - `website`: URL String (optional)
  - `profilePic`: File (optional, image)
  - `bannerImage`: File (optional, image)

---

## ❤️ 6. Interactions (Likes, Follows, Saves, Reposts)

- **POST `/api/likes/post/:postId`:** Toggle post like. Returns `{ success: true, data: { liked: boolean, likesCount: number } }`.
- **POST `/api/likes/comment/:commentId`:** Toggle comment like.
- **POST `/api/follows/:userId`:** Follow/unfollow user. Returns `{ success: true, data: { following: boolean, followersCount: number } }`.
- **POST `/api/saves/:postId`:** Save/unsave post. Returns `{ success: true, data: { saved: boolean, savesCount: number } }`.
- **POST `/api/reposts/:postId`:** Share/unshare post. Returns `{ success: true, data: { reposted: boolean, repostsCount: number } }`.

---

## 📁 7. Saved and Repost Collections

- **GET `/api/saves`:** Retrieves a list of saved posts for the current authenticated user (supports cursor pagination).
- **GET `/api/reposts`:** Retrieves posts reposted by the current user.

---

## 🔍 8. Unified Search Endpoints

- **GET `/api/search/users?q=searchTerm`:** Partial username/fullName match.
- **GET `/api/search/posts?q=searchTerm`:** Searches titles, bodies, and hashtags.

---

## 🔔 9. Notifications Endpoints

- **GET `/api/notifications`:** Fetches notifications.
- **PUT `/api/notifications/read`:** Marks all notifications as read.

---

## 💬 10. Direct Messages (Chat) Endpoints

- **POST `/api/chats/conversations`:** Create/get conversation. Body: `{ participantId: "user_id" }`.
- **GET `/api/chats/conversations`:** Fetch conversations list sorted by recent messages.
- **GET `/api/chats/conversations/:conversationId/messages`:** Messages list. Query: `page`, `limit`.
- **POST `/api/chats/conversations/:conversationId/messages`:** Send text/image attachments. Format: `multipart/form-data`. Body parameters: `content` (string), `files` (array of attachment files).
