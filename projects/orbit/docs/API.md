# Orbit API Reference

Base URL: `http://localhost:5006/api`

All protected routes require a JWT cookie (`jwt=<token>`) set via login/signup.

---

## Authentication

### POST /api/auth/signup
Create a new user account.
```json
{ "username": "john", "email": "john@test.com", "password": "Pass123!", "confirmPassword": "Pass123!", "fullName": "John Doe", "gender": "male" }
```

### POST /api/auth/login
Login with email or username.
```json
{ "usernameOrEmail": "john@test.com", "password": "Pass123!" }
```

### GET /api/auth/me
Get the currently authenticated user.

### POST /api/auth/logout
Clear the JWT cookie.

---

## Users

### GET /api/users
List users. `?cursor`, `?limit`, `?sort`

### GET /api/users/:userId
Get user by ID.

### GET /api/users/username/:username
Get user by username.

### GET /api/users/:userId/posts
Get user's posts. `?cursor`, `?limit`

### GET /api/users/:userId/pinned
Get user's pinned posts.

### GET /api/users/suggestions
Get suggested users to follow.

### POST /api/users/:userId/share
Increment profile share count.

### PUT /api/users/profile
Update own profile.

### POST /api/users/avatar
Upload/update avatar image.

### DELETE /api/users/account
Delete own account.

---

## Posts

### GET /api/posts
List posts. `?cursor`, `?limit`, `?author`, `?sort` (likesCount|viewsCount|createdAt)

### GET /api/posts/:postId
Get single post by ID.

### GET /api/posts/slug/:slug
Get post by URL slug.

### POST /api/posts
Create a post. Supports multipart file upload.
```json
{ "title": "My Post", "content": "Hello world #firstpost", "visibility": "public" }
```

### PUT /api/posts/:postId
Update own post.

### DELETE /api/posts/:postId
Delete own post.

### POST /api/posts/:postId/pin
Pin post to profile (max 3).

### POST /api/posts/:postId/unpin
Unpin from profile.

### POST /api/posts/:postId/share
Increment share count.

### POST /api/posts/:postId/views
Increment view count.

### POST /api/posts/:postId/vote
Vote on a poll. `{ "optionIndex": 0 }`

### POST /api/posts/:postId/collab/invite
Invite a collaborator. `{ "collaboratorId": "..." }`

### POST /api/posts/:postId/collab/accept
Accept collaboration invite.

### POST /api/posts/:postId/publish
Publish a draft/scheduled post.

### POST /api/posts/:postId/quote-repost
Quote repost with commentary. `{ "quoteContent": "..." }`

### GET /api/posts/hashtag/:hashtag
Get posts by hashtag. `?cursor`, `?limit`

### GET /api/posts/trending/hashtags
Get trending hashtags.

---

## Feed

### GET /api/feed
Ranked feed (authenticated). `?cursor`, `?limit`

### GET /api/feed/for-you
Personalized for-you feed. `?cursor`, `?limit`

---

## Comments

### POST /api/comments
Create a comment. `{ "post": "...", "text": "Great post!" }`

### GET /api/comments
Get all comments. `?cursor`, `?limit`

### GET /api/comments/post/:postId
Get comments for a post. `?cursor`, `?limit`

### GET /api/comments/:commentId/replies
Get replies to a comment. `?cursor`, `?limit`

### PUT /api/comments/:commentId
Edit own comment.

### DELETE /api/comments/:commentId
Delete own comment.

### POST /api/comments/:commentId/like
Toggle like on comment.

---

## Likes

### POST /api/likes/toggle
Toggle like on a post. `{ "postId": "..." }`

### POST /api/likes/comment/toggle
Toggle like on a comment. `{ "commentId": "..." }`

---

## Follows

### POST /api/follows/:userId/toggle
Follow/unfollow a user.

### GET /api/follows/:userId/followers
Get followers list. `?cursor`, `?limit`

### GET /api/follows/:userId/following
Get following list. `?cursor`, `?limit`

---

## Saves & Collections

### POST /api/saves/toggle
Toggle save on a post. `{ "postId": "..." }`

### GET /api/saves
Get saved posts. `?cursor`, `?limit`, `?folder`

### POST /api/collections
Create a collection. `{ "name": "My Collection" }`

### GET /api/collections
Get own collections. `?cursor`, `?limit`

### POST /api/collections/:collectionId/posts/:postId
Add post to collection.

### DELETE /api/collections/:collectionId/posts/:postId
Remove post from collection.

### GET /api/collections/:collectionId/posts
Get posts in a collection. `?cursor`, `?limit`

### DELETE /api/collections/:collectionId
Delete a collection.

---

## Reposts

### POST /api/reposts/toggle
Toggle repost on a post. `{ "postId": "..." }`

### GET /api/reposts
Get user's reposts. `?cursor`, `?limit`

---

## Chat

### GET /api/chats/conversations
List user's conversations.

### POST /api/chats/conversations
Create a conversation. `{ "recipientId": "..." }`

### GET /api/chats/:conversationId/messages
Get messages. `?cursor`, `?limit`

### POST /api/chats/:conversationId/messages
Send a message. `{ "text": "Hello" }`

### POST /api/chats/:conversationId/read
Mark conversation as read.

### POST /api/chats/:conversationId/messages/:messageId/delete
Delete a message.

### POST /api/chats/:conversationId/messages/:messageId/edit
Edit a message. `{ "text": "Updated" }`

### POST /api/chats/:conversationId/messages/:messageId/forward
Forward a message. `{ "targetConversationIds": [...] }`

### GET /api/chats/:conversationId/search
Search messages. `?q=keyword`, `?cursor`, `?limit`

### GET /api/chats/groups
List group chats. `?cursor`, `?limit`

### POST /api/chats/groups
Create a group chat. `{ "name": "Group", "participants": [...] }`

---

## Glimpses (Stories)

### GET /api/glimpses
Get glimpse feed. `?cursor`, `?limit`

### POST /api/glimpses
Create a glimpse (multipart file upload).

### GET /api/glimpses/:glimpseId
Get single glimpse.

### POST /api/glimpses/:glimpseId/view
Mark glimpse as viewed.

### POST /api/glimpses/:glimpseId/react
React to glimpse. `{ "emoji": "🔥" }`

### POST /api/glimpses/:glimpseId/reply
Reply to glimpse. `{ "text": "Nice!" }`

### DELETE /api/glimpses/:glimpseId
Delete own glimpse.

---

## Communities

### POST /api/communities
Create a community. `{ "name": "...", "description": "..." }`

### GET /api/communities
List communities. `?cursor`, `?limit`

### GET /api/communities/:communityId
Get community details.

### POST /api/communities/:communityId/join
Join a community.

### POST /api/communities/:communityId/leave
Leave a community.

### POST /api/communities/:communityId/messages
Post a message. `{ "text": "..." }`

### GET /api/communities/:communityId/messages
Get messages. `?cursor`, `?limit`

### PUT /api/communities/:communityId
Update community settings (admin).

---

## Notifications

### GET /api/notifications
Get notifications. `?cursor`, `?limit`

### GET /api/notifications/unread-count
Get unread notification count.

### PUT /api/notifications/:notificationId/read
Mark as read.

### PUT /api/notifications/read-all
Mark all as read.

### DELETE /api/notifications/:notificationId
Delete a notification.

### DELETE /api/notifications/clear-all
Clear all notifications.

---

## Audio Rooms

### POST /api/rooms
Create audio room. `{ "title": "...", "description": "..." }`

### GET /api/rooms
Get live rooms. `?cursor`, `?limit`

### GET /api/rooms/:roomId
Get room details.

### POST /api/rooms/:roomId/join
Join a room.

### POST /api/rooms/:roomId/leave
Leave a room.

### POST /api/rooms/:roomId/invite/:userId
Invite user to room.

---

## Moderation & Admin

### POST /api/reports
Report content. `{ "contentType": "post", "contentId": "...", "reason": "spam" }`

### GET /api/reports
Get reports (admin). `?status`, `?cursor`, `?limit`

### PUT /api/reports/:reportId/review
Review a report (admin). `{ "status": "resolved" }`

### GET /api/moderation/queue
Get moderation queue (admin). `?cursor`, `?limit`

### POST /api/moderation/flag
Flag content. `{ "targetType": "post", "targetId": "...", "reason": "..." }`

### PUT /api/moderation/:id/approve
Approve content.

### PUT /api/moderation/:id/reject
Reject content.

### POST /api/admin/feature-flags
Create a feature flag.

### GET /api/admin/feature-flags
List feature flags.

### PUT /api/admin/feature-flags/:id
Update a feature flag.

### POST /api/admin/users/:userId/mute
Toggle user mute.

### POST /api/admin/users/:userId/ban
Toggle user ban.

---

## System

### GET /api/health
Health check (MongoDB + Redis + memory + uptime).

### POST /api/push/subscribe
Subscribe to push notifications (Web Push VAPID).

### POST /api/push/unsubscribe
Unsubscribe from push notifications.

---

## Gamification

### GET /api/xp
Get user's XP and level.

### GET /api/missions
Get daily missions.

### GET /api/streaks
Get streak data.

### GET /api/leaderboard
Get leaderboard.

### GET /api/analytics/overview
Get analytics overview.

### GET /api/analytics/posts
Get per-post analytics. `?cursor`, `?limit`

### GET /api/analytics/engagement
Get engagement trends. `?period=7d|30d|90d`

---

## Search

### GET /api/search/users
Search users. `?q=term`, `?cursor`, `?limit`

### GET /api/search/posts
Search posts. `?q=term`, `?cursor`, `?limit`

---

## Trending

### GET /api/trending/users
Trending users (by follower velocity).

### GET /api/trending/topics
Trending topics (hashtag clusters).

---

## Common Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Post/comment ID for cursor-based pagination |
| `limit` | number | Items per page (default 10-20, max 50) |
| `sort` | string | Sort field (likesCount, viewsCount, createdAt) |

All paginated responses include:
```json
{
  "success": true,
  "items": [...],
  "hasMore": true,
  "nextCursor": "abc123..."
}
```
