# Orbit API Documentation — Bruno Collection

> **Base URL:** `http://localhost:5006/api` (local) or `https://your-domain.com/api` (production)
> **Auth:** Most endpoints require `Authorization: Bearer <jwt_token>` header (JWT returned on login/signup)
> **CSRF:** State-changing requests (POST, PUT, DELETE, PATCH) require `x-csrf-token` header (except in dev mode) — see CSRF section below
> **Response Format:** All endpoints return `{ success: boolean, message?: string, data?: any }`

---

## 📋 User Workflow (How Users Interact with the App)

```
Signup → Complete Onboarding → Explore Feed → Follow Users → Create Posts → 
Comment/Like/Save → Chat → Create Community → Share Glimpses → Track Streaks
```

---

## 1. AUTHENTICATION

### Workflow
```
1. User signs up (POST /signup) → session cookie set automatically
2. User logs in (POST /login) → session cookie set
3. App checks session (GET /me) on reload
4. User logs out (POST /logout) → session cleared
```

### Endpoints

#### POST /api/auth/signup
**Description:** Create a new account

**Request Body:**
```json
{
  "username": "johndoe",
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "gender": "male"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "username": "johndoe",
    "fullName": "John Doe",
    "email": "john@example.com",
    "gender": "male",
    "bio": "",
    "followersCount": 0,
    "followingCount": 0,
    "postsCount": 0,
    "isOnboarded": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/auth/login
**Description:** Login with email or username

**Request Body:**
```json
{
  "usernameOrEmail": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "username": "johndoe",
    "fullName": "John Doe",
    "email": "john@example.com",
    "avatar": null,
    "followersCount": 0,
    "followingCount": 0,
    "postsCount": 0,
    "isOnboarded": true
  }
}
```

#### POST /api/auth/logout
**Description:** Logout (clears session)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### GET /api/auth/me
**Description:** Get current authenticated user's details (used for session check on app load)

**Response (200):**
```json
{
  "success": true,
  "user": {
    "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "username": "johndoe",
    "fullName": "John Doe",
    "email": "john@example.com",
    "bio": "Software developer",
    "profilePic": { "url": "https://res.cloudinary.com/..." },
    "bannerImage": { "url": "https://res.cloudinary.com/..." },
    "followersCount": 42,
    "followingCount": 18,
    "postsCount": 7,
    "isPrivate": false,
    "isOnboarded": true,
    "isAdmin": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 2. PASSWORD MANAGEMENT

### Endpoints

#### POST /api/password/request-otp
**Description:** Request OTP for password reset

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to email"
}
```

#### POST /api/password/forgot
**Description:** Verify OTP

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP verified"
}
```

#### POST /api/password/reset
**Description:** Reset password with verified OTP

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456",
  "password": "NewSecurePass456!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

#### PUT /api/users/update-password
**Description:** Update password while logged in

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

## 3. USER PROFILE & SETTINGS

### Workflow
```
1. View own profile (GET /users/:userId) → shows posts, followers, following
2. Edit profile → (frontend handles, PUT to /users/:userId or equivalent)
3. View other users by username (GET /users/username/:username)
4. Get user suggestions (GET /users/suggestions) → for "Who to follow"
5. View another user's posts (GET /users/:userId/posts)
```

### Endpoints

#### GET /api/users/username/:username
**Description:** Get user by username

**Response (200):**
```json
{
  "success": true,
  "user": {
    "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "username": "johndoe",
    "fullName": "John Doe",
    "bio": "Software developer",
    "profilePic": { "url": "https://..." },
    "bannerImage": { "url": "https://..." },
    "followersCount": 42,
    "followingCount": 18,
    "postsCount": 7,
    "isPrivate": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /api/users/:userId
**Description:** Get user by ID with follow status

**Response (200):**
```json
{
  "success": true,
  "user": { "...user fields..." },
  "followingByMe": true,
  "followedByThem": false
}
```

#### GET /api/users/suggestions
**Description:** Get suggested users to follow (excludes already-followed users)

**Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "_id": "64b2c3d4e5f6a7b8c9d0e1f2",
      "username": "janedoe",
      "fullName": "Jane Doe",
      "profilePic": { "url": "https://..." },
      "followersCount": 15,
      "followingCount": 30
    }
  ]
}
```

#### GET /api/users/:userId/posts
**Description:** Get posts by a specific user

**Query Params:** `?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "posts": [ "...array of post objects..." ],
  "page": 1,
  "hasMore": true
}
```

#### GET /api/users/:userId/pinned
**Description:** Get pinned posts of a user

**Response (200):**
```json
{
  "success": true,
  "posts": [ "...array of pinned posts..." ]
}
```

#### POST /api/users/:userId/share
**Description:** Share a user profile (increments shares count)

**Response (200):**
```json
{
  "success": true,
  "message": "User shared"
}
```

#### POST /api/users/:userId/view
**Description:** Record a profile view

**Response (200):**
```json
{
  "success": true
}
```

#### DELETE /api/users/delete-account
**Description:** Delete own account permanently

**Response (200):**
```json
{
  "success": true,
  "message": "Account deleted"
}
```

---

## 4. FOLLOWS

### Workflow
```
1. Follow a user (POST /follows/:userId)
2. View followers (GET /follows/:userId/followers)
3. View following (GET /follows/:userId/following)
4. Unfollow = POST same endpoint again (toggle)
```

### Endpoints

#### POST /api/follows/:userId
**Description:** Toggle follow/unfollow a user

**Response (200):**
```json
{
  "success": true,
  "following": true,
  "followersCount": 43
}
```

#### GET /api/follows/:userId/followers
**Description:** Get followers of a user

**Query Params:** `?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "followers": [
    {
      "_id": "64b2c3d4e5f6a7b8c9d0e1f2",
      "username": "janedoe",
      "fullName": "Jane Doe",
      "profilePic": { "url": "https://..." }
    }
  ],
  "hasMore": false
}
```

#### GET /api/follows/:userId/following
**Description:** Get users that a user is following

**Query Params:** `?limit=100`

**Response (200):**
```json
{
  "success": true,
  "following": [
    {
      "_id": "...",
      "following": { "_id": "...", "username": "..." }
    }
  ]
}
```

---

## 5. POSTS

### Workflow
```
1. Create post → (Multipart form: content, images[], poll options, scheduleAt, isDraft)
2. Feed shows posts from followed users + discovery
3. Like/Unlike posts (POST /likes/post/:postId)
4. Save posts (POST /saves/:postId)
5. Repost/Quote Repost (POST /reposts/:postId)
6. Share post (POST /posts/:postId/share)
7. Edit/Draft/Schedule posts (advanced)
```

### Endpoints

#### GET /api/posts
**Description:** Get posts feed (authenticated — shows from followed users + suggestions)

**Query Params:** `?page=1&limit=20&hashtag=tech`

**Response (200):**
```json
{
  "success": true,
  "posts": [
    {
      "_id": "64c3d4e5f6a7b8c9d0e1f2a3",
      "content": "Hello world!",
      "title": "My first post",
      "images": [{ "url": "https://...", "publicId": "abc" }],
      "author": {
        "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
        "username": "johndoe",
        "fullName": "John Doe",
        "profilePic": { "url": "https://..." }
      },
      "likeCount": 5,
      "commentCount": 2,
      "saveCount": 1,
      "repostCount": 0,
      "shareCount": 0,
      "viewsCount": 42,
      "isLiked": false,
      "isSaved": false,
      "isReposted": false,
      "hasPoll": false,
      "isDraft": false,
      "status": "published",
      "tags": ["tech", "coding"],
      "createdAt": "2024-01-02T12:00:00.000Z"
    }
  ],
  "page": 1,
  "hasMore": true
}
```

#### GET /api/posts/:postId
**Description:** Get single post by ID

**Response (200):**
```json
{
  "success": true,
  "post": { "...post object with full details..." }
}
```

#### GET /api/posts/slug/:slug
**Description:** Get post by URL slug

**Response (200):**
```json
{
  "success": true,
  "post": { "...post object..." }
}
```

#### GET /api/posts/hashtag/:hashtag
**Description:** Get posts by hashtag

**Query Params:** `?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "posts": [ "...array of posts..." ],
  "page": 1,
  "hasMore": true
}
```

#### DELETE /api/posts/:postId
**Description:** Delete own post

**Response (200):**
```json
{
  "success": true,
  "message": "Post deleted"
}
```

#### POST /api/posts/:postId/view
**Description:** Record post view

**Response (200):**
```json
{
  "success": true,
  "viewsCount": 43
}
```

#### POST /api/posts/:postId/share
**Description:** Share a post (increments share count)

**Response (200):**
```json
{
  "success": true,
  "message": "Post shared"
}
```

#### POST /api/posts/:postId/pin
**Description:** Pin post to profile top

**Response (200):**
```json
{
  "success": true,
  "message": "Post pinned"
}
```

#### POST /api/posts/:postId/unpin
**Description:** Unpin post from profile

**Response (200):**
```json
{
  "success": true,
  "message": "Post unpinned"
}
```

#### POST /api/posts/:postId/vote
**Description:** Vote on a poll post

**Request Body:**
```json
{
  "optionIndex": 0
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Vote recorded"
}
```

#### POST /api/posts/:postId/collab-invite
**Description:** Invite a user to collaborate on a post

**Request Body:**
```json
{
  "userId": "64b2c3d4e5f6a7b8c9d0e1f2"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Collaboration invitation sent"
}
```

#### POST /api/posts/:postId/collab-accept
**Description:** Accept a collaboration invitation

**Response (200):**
```json
{
  "success": true,
  "message": "Collaboration accepted"
}
```

#### POST /api/posts/:postId/publish
**Description:** Publish a draft/scheduled post

**Response (200):**
```json
{
  "success": true,
  "message": "Post published",
  "post": { "...post object..." }
}
```

#### POST /api/posts/:postId/quote-repost
**Description:** Create a quote repost (repost with comment)

**Request Body (Multipart):**
```json
{
  "content": "Check this out!",
  "images": [File]
}
```

**Response (201):**
```json
{
  "success": true,
  "post": { "...new post (quote repost)..." }
}
```

#### GET /api/posts/trending/hashtags
**Description:** Get trending hashtags

**Response (200):**
```json
{
  "success": true,
  "hashtags": [
    { "tag": "tech", "count": 42 },
    { "tag": "coding", "count": 35 },
    { "tag": "design", "count": 28 }
  ]
}
```

---

## 6. LIKES

### Endpoints

#### POST /api/likes/post/:postId
**Description:** Toggle like/unlike a post

**Response (200):**
```json
{
  "success": true,
  "isLiked": true,
  "likesCount": 10
}
```

---

## 7. COMMENTS

### Workflow
```
1. View comments on a post (GET /comments/:postId)
2. Post a comment (POST /comments/:postId)
3. Edit comment (PUT /comments/:commentId)
4. Delete comment (DELETE /comments/:commentId)
5. React to comment (POST /comments/:commentId/reactions)
```

### Endpoints

#### GET /api/comments/:postId
**Description:** Get comments for a post

**Query Params:** `?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "comments": [
    {
      "_id": "64d4e5f6a7b8c9d0e1f2a3b4",
      "content": "Great post!",
      "author": {
        "_id": "...",
        "username": "janedoe",
        "fullName": "Jane Doe",
        "profilePic": { "url": "https://..." }
      },
      "likeCount": 3,
      "repliesCount": 1,
      "isLiked": false,
      "reactions": [],
      "createdAt": "2024-01-03T10:00:00.000Z"
    }
  ],
  "hasMore": false
}
```

#### GET /api/comments/:postId/all
**Description:** Get all comments (paginated)

#### POST /api/comments/:postId
**Description:** Add a comment

**Request Body:**
```json
{
  "content": "This is great!",
  "parentComment": null
}
```

**Response (201):**
```json
{
  "success": true,
  "comment": { "...comment object..." }
}
```

#### PUT /api/comments/:commentId
**Description:** Edit own comment

**Request Body:**
```json
{
  "content": "Updated comment text"
}
```

**Response (200):**
```json
{
  "success": true,
  "comment": { "...updated comment..." }
}
```

#### DELETE /api/comments/:commentId
**Description:** Delete own comment

**Response (200):**
```json
{
  "success": true,
  "message": "Comment deleted"
}
```

#### GET /api/comments/replies/:commentId
**Description:** Get replies to a comment

#### POST /api/comments/:commentId/reactions
**Description:** Add/remove reaction emoji on comment

**Request Body:**
```json
{
  "emoji": "🔥"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Reaction toggled"
}
```

---

## 8. SAVES

### Endpoints

#### POST /api/saves/:postId
**Description:** Toggle save/unsave a post

**Response (200):**
```json
{
  "success": true,
  "isSaved": true,
  "savesCount": 5
}
```

#### GET /api/saves
**Description:** Get user's saved posts

**Query Params:** `?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "posts": [ "...array of saved posts..." ],
  "hasMore": false
}
```

#### PATCH /api/saves/:postId/folder
**Description:** Move saved post to a folder

**Request Body:**
```json
{
  "folder": "Read Later"
}
```

**Response (200):**
```json
{
  "success": true
}
```

#### GET /api/saves/folders
**Description:** Get all save folders/categories

**Response (200):**
```json
{
  "success": true,
  "folders": [
    { "name": "Read Later", "count": 3 },
    { "name": "Inspiration", "count": 7 }
  ]
}
```

---

## 9. REPOSTS

### Endpoints

#### POST /api/reposts/:postId
**Description:** Toggle repost/unrepost a post

**Response (200):**
```json
{
  "success": true,
  "isReposted": true,
  "repostsCount": 3
}
```

#### GET /api/reposts
**Description:** Get user's reposted posts

**Query Params:** `?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "posts": [ "...array of reposted posts..." ]
}
```

---

## 10. FEED

### Endpoints

#### GET /api/feed
**Description:** Get ranked/algorithmic feed (affinity-based scoring)

**Query Params:** `?cursor=<cursor>&limit=20`

**Response (200):**
```json
{
  "success": true,
  "posts": [ "...ranked post objects..." ],
  "nextCursor": "abc123...",
  "hasMore": true
}
```

---

## 11. SEARCH

### Endpoints

#### GET /api/search/users
**Description:** Search users by username/fullName

**Query Params:** `?q=johndoe&page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "users": [ "...array of matching users..." ]
}
```

#### GET /api/search/posts
**Description:** Search posts by content

**Query Params:** `?q=hello&page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "posts": [ "...array of matching posts..." ]
}
```

---

## 12. CHAT / MESSAGES

### Workflow
```
1. Create conversation (POST /chats/conversations)
2. View conversations (GET /chats/conversations)
3. Send message → (Socket: message:new) or via conversation endpoint
4. Edit message (PUT /chats/messages/:messageId)
5. Delete message (DELETE /chats/messages/:messageId)
6. React to message (POST /chats/messages/:messageId/reactions)
7. Search in conversation (GET /chats/conversations/:conversationId/search)
```

### Endpoints

#### POST /api/chats/conversations
**Description:** Create or get existing conversation with a user

**Request Body:**
```json
{
  "recipientId": "64b2c3d4e5f6a7b8c9d0e1f2",
  "initialMessage": "Hey there!"
}
```

**Response (200):**
```json
{
  "success": true,
  "conversation": {
    "_id": "64e5f6a7b8c9d0e1f2a3b4c5",
    "participants": [
      { "_id": "...", "username": "johndoe", "fullName": "John Doe" },
      { "_id": "...", "username": "janedoe", "fullName": "Jane Doe" }
    ],
    "lastMessage": { "...message object..." },
    "unreadCounts": { "userId_1": 0, "userId_2": 1 },
    "updatedAt": "2024-01-04T15:00:00.000Z"
  }
}
```

#### GET /api/chats/conversations
**Description:** Get all conversations for current user

**Response (200):**
```json
{
  "success": true,
  "conversations": [ "...array of conversation objects..." ]
}
```

#### DELETE /api/chats/conversations/:conversationId
**Description:** Delete a conversation

#### DELETE /api/chats/conversations/:conversationId/messages
**Description:** Clear all messages in a conversation (clear chat history)

#### GET /api/chats/conversations/:conversationId/messages
**Description:** Get messages in a conversation

**Query Params:** `?page=1&limit=50`

**Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "_id": "64f6a7b8c9d0e1f2a3b4c5d6",
      "conversation": "64e5f6a7b8c9d0e1f2a3b4c5",
      "sender": "64a1b2c3d4e5f6a7b8c9d0e1",
      "text": "Hello!",
      "attachments": [],
      "reactions": [],
      "isDeleted": false,
      "editedAt": null,
      "createdAt": "2024-01-04T15:00:00.000Z"
    }
  ],
  "page": 1,
  "hasMore": false
}
```

#### PUT /api/chats/messages/:messageId
**Description:** Edit own message

**Request Body:**
```json
{
  "text": "Updated message text"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": { "...updated message object..." }
}
```

#### DELETE /api/chats/messages/:messageId
**Description:** Delete a message (for everyone)

#### DELETE /api/chats/messages/:messageId/delete-for-me
**Description:** Delete a message only for yourself

#### DELETE /api/chats/messages/:messageId/undo
**Description:** Undo send (within time limit)

#### POST /api/chats/messages/:messageId/reactions
**Description:** Toggle reaction on a message

**Request Body:**
```json
{
  "emoji": "❤️"
}
```

**Response (200):**
```json
{
  "success": true,
  "reactions": [ { "emoji": "❤️", "count": 1, "users": ["..."] } ]
}
```

#### GET /api/chats/conversations/:conversationId/search
**Description:** Search messages within a conversation

**Query Params:** `?q=hello&page=1&limit=20`

#### GET /api/chats/users/:userId/presence
**Description:** Check if a user is online

**Response (200):**
```json
{
  "success": true,
  "status": "online"
}
```

---

## 13. COMMUNITIES

### Workflow
```
1. Browse communities (GET /communities)
2. View community detail (GET /communities/:communityId)
3. Join community (POST /communities/:communityId/join)
4. Send message → (via community message endpoints)
5. Leave community (POST /communities/:communityId/leave)
6. Create community (POST /communities) [creator]
7. Edit community (PUT /communities/:communityId) [creator]
8. Delete community (DELETE /communities/:communityId) [creator]
9. Pin messages (POST /communities/messages/:messageId/pin) [admin]
```

### Endpoints

#### POST /api/communities
**Description:** Create a new community. Works with JSON body; multipart only needed when uploading an image.

**Request Body (JSON — no image):**
```json
{
  "name": "Tech Enthusiasts",
  "description": "A place for tech lovers"
}
```

**Request Body (Multipart — with image):**
| Field | Type |
|-------|------|
| `name` | text |
| `description` | text |
| `image` | file (optional) |

**Response (201):**
```json
{
  "success": true,
  "community": {
    "_id": "64a7b8c9d0e1f2a3b4c5d6e7",
    "name": "Tech Enthusiasts",
    "description": "A place for tech lovers",
    "profileImage": { "url": "https://..." },
    "creator": "64a1b2c3d4e5f6a7b8c9d0e1",
    "memberCount": 1,
    "createdAt": "2024-01-05T00:00:00.000Z"
  }
}
```

#### GET /api/communities
**Description:** Browse all communities (paginated)

**Query Params:** `?page=1&limit=20&search=tech`

**Response (200):**
```json
{
  "success": true,
  "communities": [
    {
      "_id": "64a7b8c9d0e1f2a3b4c5d6e7",
      "name": "Tech Enthusiasts",
      "description": "A place for tech lovers",
      "profileImage": { "url": "https://..." },
      "creator": { "_id": "...", "username": "johndoe" },
      "memberCount": 15,
      "isMember": false,
      "createdAt": "2024-01-05T00:00:00.000Z"
    }
  ],
  "hasMore": true
}
```

#### GET /api/communities/mine
**Description:** Get communities the current user has joined

**Response (200):**
```json
{
  "success": true,
  "communities": [ "...array of communities..." ]
}
```

#### GET /api/communities/:communityId
**Description:** Get community details

#### PUT /api/communities/:communityId
**Description:** Update community info (creator only)

**Request Body (Multipart):**
```json
{
  "name": "Tech Enthusiasts v2",
  "description": "Updated description",
  "profileImage": [File]
}
```

**Response (200):**
```json
{
  "success": true,
  "community": { "...updated community..." }
}
```

#### DELETE /api/communities/:communityId
**Description:** Delete community (creator only)

#### POST /api/communities/:communityId/join
**Description:** Join a community

**Response (200):**
```json
{
  "success": true,
  "message": "Joined community",
  "memberCount": 16
}
```

#### POST /api/communities/:communityId/leave
**Description:** Leave a community

**Response (200):**
```json
{
  "success": true,
  "message": "Left community",
  "memberCount": 14
}
```

#### GET /api/communities/:communityId/members
**Description:** Get community members

**Query Params:** `?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "members": [
    {
      "user": { "_id": "...", "username": "janedoe", "fullName": "Jane Doe" },
      "role": "member",
      "joinedAt": "2024-01-06T00:00:00.000Z"
    }
  ],
  "hasMore": true
}
```

#### GET /api/communities/:communityId/messages
**Description:** Get community chat messages

**Query Params:** `?page=1&limit=50`

#### PUT /api/communities/messages/:messageId
**Description:** Edit own community message

#### DELETE /api/communities/messages/:messageId
**Description:** Delete community message (for everyone)

#### DELETE /api/communities/messages/:messageId/delete-for-me
**Description:** Delete community message for self

#### POST /api/communities/messages/:messageId/reactions
**Description:** Toggle reaction on community message

**Request Body:**
```json
{
  "emoji": "👍"
}
```

#### GET /api/communities/:communityId/pinned-messages
**Description:** Get pinned messages in a community

#### POST /api/communities/messages/:messageId/pin
**Description:** Pin a message (admin only)

#### POST /api/communities/messages/:messageId/unpin
**Description:** Unpin a message

---

## 14. NOTIFICATIONS

### Endpoints

#### GET /api/notifications
**Description:** Get user's notifications

**Query Params:** `?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "notifications": [
    {
      "_id": "64b8c9d0e1f2a3b4c5d6e7f8",
      "type": "like",
      "sender": { "_id": "...", "username": "janedoe", "fullName": "Jane Doe" },
      "post": { "_id": "...", "title": "Post title" },
      "read": false,
      "createdAt": "2024-01-07T00:00:00.000Z"
    }
  ],
  "hasMore": true
}
```

#### GET /api/notifications/unread-count
**Description:** Get count of unread notifications

**Response (200):**
```json
{
  "success": true,
  "unreadCount": 5
}
```

#### PUT /api/notifications/mark-as-read
**Description:** Mark all notifications as read

#### PUT /api/notifications/read
**Description:** Alternative mark-all-read endpoint

#### PUT /api/notifications/mark-as-read/:notificationId
**Description:** Mark a single notification as read

#### PUT /api/notifications/:notificationId/read
**Description:** Alternative single mark-read

#### DELETE /api/notifications/clear-all
**Description:** Delete all notifications

#### DELETE /api/notifications/:notificationId
**Description:** Delete a specific notification

---

## 15. GLIMPSES (Ephemeral Stories)

### Workflow
```
1. Create a glimpse (photo/video that disappears)
2. View glimpse feed (GET /glimpses/feed)
3. View a glimpse (POST /glimpses/:glimpseId/view) → decrements remaining views
4. React to glimpse (POST /glimpses/:glimpseId/reactions)
5. Reply to glimpse (POST /glimpses/:glimpseId/reply)
```

### Endpoints

#### POST /api/glimpses
**Description:** Create a new glimpse (ephemeral story)

**Request Body (Multipart):**
```json
{
  "media": [File],
  "caption": "Quick thought!",
  "maxViews": 5,
  "expiresInHours": 24
}
```

**Response (201):**
```json
{
  "success": true,
  "glimpse": {
    "_id": "64c9d0e1f2a3b4c5d6e7f8a9",
    "media": { "url": "https://...", "publicId": "abc" },
    "caption": "Quick thought!",
    "author": { "_id": "...", "username": "johndoe" },
    "remainingViews": 5,
    "totalViews": 0,
    "expiresAt": "2024-01-08T00:00:00.000Z",
    "createdAt": "2024-01-07T00:00:00.000Z"
  }
}
```

#### GET /api/glimpses/feed
**Description:** Get glimpses feed (from followed users)

#### GET /api/glimpses/:glimpseId
**Description:** Get a specific glimpse

#### POST /api/glimpses/:glimpseId/view
**Description:** View a glimpse (consumes one view)

#### POST /api/glimpses/:glimpseId/reactions
**Description:** React to a glimpse

**Request Body:**
```json
{
  "emoji": "🔥"
}
```

#### POST /api/glimpses/:glimpseId/reply
**Description:** Reply to a glimpse

**Request Body:**
```json
{
  "content": "Nice story!"
}
```

#### DELETE /api/glimpses/:glimpseId
**Description:** Delete own glimpse

---

## 16. COLLECTIONS

### Workflow
```
1. Create a collection (POST /collections)
2. Add posts to collection (POST /collections/:collectionId/posts/:postId)
3. View collections (GET /collections)
4. View collection detail (GET /collections/:collectionId)
```

### Endpoints

#### POST /api/collections
**Description:** Create a new collection

**Request Body (JSON — no file upload needed):**
```json
{
  "name": "Best of Tech",
  "description": "My favorite tech posts"
}
```

**Response (201):**
```json
{
  "success": true,
  "collection": {
    "_id": "64d0e1f2a3b4c5d6e7f8a9b0",
    "name": "Best of Tech",
    "description": "My favorite tech posts",
    "postCount": 0,
    "createdAt": "2024-01-08T00:00:00.000Z"
  }
}
```

#### GET /api/collections
**Description:** Get user's collections

#### GET /api/collections/:collectionId
**Description:** Get collection with posts

#### POST /api/collections/:collectionId/posts/:postId
**Description:** Add a post to collection

#### DELETE /api/collections/:collectionId/posts/:postId
**Description:** Remove a post from collection

#### DELETE /api/collections/:collectionId
**Description:** Delete a collection

---

## 17. STREAKS & DAILY MISSIONS

### Workflow
```
1. Check streak (GET /streaks/my)
2. Claim daily reward (POST /streaks/reward/claim or POST /dailyMission/claim)
3. View leaderboard (GET /leaderboard)
```

### Endpoints

#### GET /api/streaks
**Description:** Get streak leaderboard

#### GET /api/streaks/my
**Description:** Get own streak data

**Response (200):**
```json
{
  "success": true,
  "streak": {
    "currentStreak": 5,
    "longestStreak": 12,
    "lastActiveDate": "2024-01-08",
    "todayClaimed": true
  }
}
```

#### POST /api/streaks/reward/claim
**Description:** Claim streak reward

#### POST /api/streaks/partner/:partnerId
**Description:** Start a streak with a partner

#### GET /api/missions/today
**Description:** Get today's missions

**Response (200):**
```json
{
  "success": true,
  "missions": [
    { "id": "...", "type": "like", "description": "Like 3 posts", "progress": 1, "target": 3, "completed": false, "xpReward": 50 }
  ]
}
```

#### POST /api/missions/claim
**Description:** Claim mission reward

---

## 18. XP & LEVELS

### Endpoints

#### GET /api/xp
**Description:** Get own XP and level

**Response (200):**
```json
{
  "success": true,
  "xp": 1250,
  "level": 5,
  "xpToNextLevel": 250,
  "totalForNextLevel": 1500
}
```

#### GET /api/xp/:userId
**Description:** Get another user's XP

---

## 19. AUDIO ROOMS

### Workflow
```
1. Browse live rooms (GET /rooms/live)
2. Create room (POST /rooms)
3. Join room (POST /rooms/:roomId/join)
4. Leave room (POST /rooms/:roomId/leave)
```

### Endpoints

#### GET /api/rooms/live
**Description:** Get all live audio rooms

#### GET /api/rooms/:roomId
**Description:** Get room details

#### POST /api/rooms
**Description:** Create an audio room

**Request Body:**
```json
{
  "title": "Tech Talk",
  "description": "Discussing latest tech trends",
  "isPrivate": false
}
```

#### POST /api/rooms/:roomId/join
**Description:** Join an audio room

#### POST /api/rooms/:roomId/leave
**Description:** Leave an audio room

#### POST /api/rooms/:roomId/invite/:userId
**Description:** Invite a user to the room

---

## 20. BLOCK & MUTE

### Endpoints

#### POST /api/block/:userId
**Description:** Block a user

#### DELETE /api/block/:userId
**Description:** Unblock a user

#### GET /api/block
**Description:** Get blocked users list

#### GET /api/block/:userId/check
**Description:** Check if a user is blocked

#### POST /api/block/:userId/mute
**Description:** Mute a user

#### DELETE /api/block/:userId/mute
**Description:** Unmute a user

---

## 21. CLOSE FRIENDS

### Endpoints

#### POST /api/close-friends/:userId
**Description:** Add user to close friends

#### DELETE /api/close-friends/:userId
**Description:** Remove user from close friends

#### GET /api/close-friends
**Description:** Get close friends list

#### GET /api/close-friends/:userId/check
**Description:** Check if user is a close friend

---

## 22. INVITE SYSTEM

### Workflow
```
1. Get invite code (GET /invites/code)
2. Share code → other user signs up with code
3. Track invites (GET /invites)
4. View stats (GET /invites/stats)
```

### Endpoints

#### GET /api/invites/code
**Description:** Get or generate invite code

#### GET /api/invites
**Description:** Get user's invites

#### GET /api/invites/stats
**Description:** Get invite statistics

#### POST /api/invites/redeem/:code
**Description:** Redeem an invite code

---

## 23. REPORTS & MODERATION

### Workflow
```
1. User reports content (POST /reports)
2. Admin reviews pending reports (GET /reports?status=pending)
3. Admin approves/dismisses (PUT /reports/:reportId/review)
```

### Endpoints

#### POST /api/reports
**Description:** Submit a report

**Request Body:**
```json
{
  "contentType": "post",
  "contentId": "64c3d4e5f6a7b8c9d0e1f2a3",
  "reason": "spam",
  "description": "This post contains spam links"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Report submitted"
}
```

#### GET /api/reports
**Description:** Get reports (admin: all; user: own)

**Query Params:** `?status=pending&limit=20`

#### PUT /api/reports/:reportId/review
**Description:** Review a report (admin)

**Request Body:**
```json
{
  "status": "resolved",
  "action": "warning_sent"
}
```

---

## 24. ADMIN DASHBOARD

### Endpoints

#### GET /api/admin/flags/mine
**Description:** Get feature flags for current user

#### GET /api/admin/flags
**Description:** Get all feature flags

#### POST /api/admin/flags
**Description:** Create a feature flag

**Request Body:**
```json
{
  "key": "new_ui_enabled",
  "description": "Enable new UI design",
  "enabled": false,
  "percentage": 50,
  "adminOverride": false
}
```

#### PUT /api/admin/flags/:flagId
**Description:** Update a feature flag

**Request Body:**
```json
{
  "enabled": true,
  "percentage": 75
}
```

#### PUT /api/admin/users/:userId/mute
**Description:** Toggle mute status for a user

#### PUT /api/admin/users/:userId/ban
**Description:** Toggle ban status for a user

---

## 25. ARCHIVE

### Endpoints

#### POST /api/posts/:postId/archive
**Description:** Archive a post (hide from profile, keep content)

#### POST /api/posts/:postId/unarchive
**Description:** Unarchive a post

#### GET /api/posts/archived
**Description:** Get archived posts

---

## 26. LINK PREVIEW

### Endpoints

#### GET /api/link-preview
**Description:** Get Open Graph metadata for a URL

**Query Params:** `?url=https://example.com`

**Response (200):**
```json
{
  "success": true,
  "preview": {
    "url": "https://example.com",
    "title": "Example Title",
    "description": "Page description",
    "image": "https://example.com/og-image.jpg",
    "favicon": "https://example.com/favicon.ico",
    "siteName": "Example"
  }
}
```

---

## 27. PUSH NOTIFICATIONS

### Endpoints

#### GET /api/push/vapid-key
**Description:** Get VAPID public key for push subscription

#### POST /api/push/subscribe
**Description:** Subscribe to push notifications

**Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "BIO...",
    "auth": "Q2w..."
  }
}
```

#### POST /api/push/unsubscribe
**Description:** Unsubscribe from push notifications

---

## 28. TRANSLATION

### Endpoints

#### POST /api/translate
**Description:** Translate text

**Request Body:**
```json
{
  "text": "Hello world",
  "targetLanguage": "es"
}
```

#### POST /api/translate/detect
**Description:** Detect language of text

**Request Body:**
```json
{
  "text": "Bonjour le monde"
}
```

---

## 29. FOLLOW REQUESTS (Private Accounts)

### Workflow
```
1. User sets account to private
2. When someone follows a private account → follow request is created
3. Private account owner can approve/decline requests
```

### Endpoints

#### POST /api/users/:userId/follow-request
**Description:** Request to follow a private account

#### POST /api/users/:userId/approve-request
**Description:** Approve a follow request

#### POST /api/users/:userId/decline-request
**Description:** Decline a follow request

---

## 🔌 SOCKET EVENTS (WebSocket — Real-time)

### Connection
```
Socket URL: <base-url> (same server)
Transports: polling, websocket
Auth: via session cookie (withCredentials: true)
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `presence:heartbeat` | `{}` | Keep-alive ping (every 25s) |
| `typing:start` | `{ conversationId }` | User started typing |
| `typing:stop` | `{ conversationId }` | User stopped typing |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | `{ message }` | New message in a conversation |
| `message:delete` | `{ messageId }` | A message was deleted |
| `notification` | `{ Notification }` | New notification (like, follow, comment) |
| `chat:notification` | `{ conversationId, message, unreadCount }` | Chat notification with badge count |
| `user:presence` | `{ userId, status }` | User online/offline status changed |
| `user:follow` | `{ targetUserId, followerId, followersCount }` | Someone followed a user |
| `user:unfollow` | `{ targetUserId, followerId, followersCount }` | Someone unfollowed a user |
| `post:like` | `{ postId, userId, likesCount }` | Post was liked |
| `post:unlike` | `{ postId, userId, likesCount }` | Post was unliked |
| `post:save` | `{ postId, userId, savesCount }` | Post was saved |
| `post:unsave` | `{ postId, userId, savesCount }` | Post was unsaved |
| `post:repost` | `{ postId, userId, repostsCount }` | Post was reposted |
| `post:unrepost` | `{ postId, userId, repostsCount }` | Post was unreposted |
| `post:share` | `{ postId, sharesCount }` | Post was shared |
| `post:created` | `{ post }` | New post created by followed user |
| `post:deleted` | `{ postId }` | Post was deleted |
| `post:updated` | `{ post }` | Post was edited |
| `post:comment` | `{ postId, comment, commentsCount }` | New comment on a post |
| `post:view` | `{ postId, viewsCount }` | Post view count updated |
| `comment:reply` | `{ postId, commentId, reply }` | Reply to a comment |
| `comment:updated` | `{ comment }` | Comment was edited |
| `comment:deleted` | `{ postId, commentId, commentsCount }` | Comment was deleted |
| `comment:reaction` | `{ commentId, reaction, type }` | Reaction on a comment |
| `comment:like` | `{ commentId, likesCount }` | Comment was liked |
| `comment:unlike` | `{ commentId, likesCount }` | Comment was unliked |
| `glimpse:created` | `{ glimpse }` | New glimpse created |
| `glimpse:expired` | `{ glimpseId }` | Glimpse expired |
| `glimpse:viewed` | `{ glimpseId, viewerId }` | Glimpse was viewed |
| `glimpse:reacted` | `{ glimpseId, emoji, action }` | Reaction on a glimpse |
| `call:offer` | `{ callerId, sdp, type }` | Incoming call offer |
| `call:answer` | `{ calleeId, sdp }` | Call was answered |
| `call:ice-candidate` | `{ senderId, candidate }` | ICE candidate for WebRTC |
| `call:ice-restart` | `{ senderId, sdp }` | ICE restart offer |
| `call:end` | `{ endedBy }` | Call ended |
| `call:missed` | `{ callerId }` | Call was missed |

---

## 📝 Standard API Patterns

### Authentication
- Authentication uses **JWT Bearer tokens** (returned in the `token` field on signup/login)
- Set the `Authorization: Bearer <token>` header on all authenticated requests
- The server also accepts the JWT via an httpOnly `jwt` cookie as a fallback
- On 401 response, frontend dispatches `auth:expired` event → redirects to login
- Protected routes use the `protect` middleware (verifies the JWT)

### CSRF Protection (Production Only)
- Uses the **double-submit cookie** pattern
- Login/signup sets a `csrf-token` cookie (httpOnly, sameSite lax)
- For all state-changing requests (POST, PUT, DELETE, PATCH), include:
  - `x-csrf-token` header with the value from the `csrf-token` cookie
  - `Origin` header matching the allowed origin
- **In development** (NODE_ENV !== 'production'), CSRF validation is **bypassed** — you can test without the `x-csrf-token` header
- **In production**, missing or mismatched CSRF tokens return `403` with `"CSRF token mismatch"`

### Pagination
- List endpoints accept `?page=1&limit=20` query params
- Some use cursor-based pagination: `?cursor=<id>&limit=20`
- Responses include `hasMore: boolean` and optionally `nextCursor`

### File Uploads
- Post creation, profile/community images use `multipart/form-data`
- Images are uploaded to Cloudinary (via upload middleware)
- The `images` field accepts multiple files

### Error Responses
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

### Bruno Testing Tips
- Set a `BASE_URL` variable: `http://localhost:5006/api`
- Login first → extract the `token` from the response → set it as `Authorization: Bearer {{token}}` header
- In development, CSRF header is **not required** (bypassed locally)
- In production, login sets a `csrf-token` cookie — read it with a Bruno script and set `x-csrf-token` header
- Create a Bruno collection with folders matching the sections above
- For file uploads, use Bruno's "Multipart Form" body type
