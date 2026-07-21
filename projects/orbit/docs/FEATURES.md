# Orbit Backend — Feature Reference

## Core Social Features

| Feature | Status | Endpoints |
|---------|--------|-----------|
| **User Authentication** | ✅ Complete | Signup, login, logout, session, JWT cookies |
| **User Profiles** | ✅ Complete | CRUD, avatar upload, bio, links, settings |
| **Posts** | ✅ Complete | CRUD, images, videos, polls, hashtags, close friends visibility |
| **Comments** | ✅ Complete | CRUD, nested replies, reactions |
| **Likes** | ✅ Complete | Toggle on posts & comments |
| **Follow System** | ✅ Complete | Follow/unfollow, followers/following lists, close friends |
| **Reposts** | ✅ Complete | Repost toggle, quote reposts with commentary |
| **Saved Posts** | ✅ Complete | Collections, folder organization, save/unsave |
| **Feed** | ✅ Complete | Ranked feed (affinity-based), for-you feed, cursor pagination |

## Communication

| Feature | Status | Endpoints |
|---------|--------|-----------|
| **Real-time Chat** | ✅ Complete | 1-on-1 messaging, Socket.IO, typing indicators |
| **Group Chats** | ✅ Complete | Multi-participant, admin controls |
| **Audio Rooms** | ✅ Complete | Live audio, host/speaker/listener roles, invites |
| **Communities** | ✅ Complete | Create, join, posts, messages, moderation |
| **Notifications** | ✅ Complete | Real-time via Socket.IO, in-app, push |

## Content Features

| Feature | Status | Endpoints |
|---------|--------|-----------|
| **Glimpses (Stories)** | ✅ Complete | 12h expiry, image/video, reactions, replies, view tracking |
| **Collections** | ✅ Complete | User-curated post collections |
| **Hashtags** | ✅ Complete | Extraction, trending, search by hashtag |
| **Trending** | ✅ Complete | Hashtags, users, topics (7-day aggregation) |
| **Link Previews** | ✅ Complete | OpenGraph metadata extraction |
| **Polls** | ✅ Complete | Create, vote, expiry, result tracking |
| **Drafts & Scheduling** | ✅ Complete | Save drafts, schedule posts for later |

## Moderation & Admin

| Feature | Status | Endpoints |
|---------|--------|-----------|
| **Content Reporting** | ✅ Complete | Report posts/comments/users, reason categories |
| **Moderation Queue** | ✅ Complete | Admin review, approve/reject, auto-hide at 3 flags |
| **Admin Dashboard** | ✅ Complete | Feature flags, user flags, mute/ban, system config |
| **Block System** | ✅ Complete | Block/unblock, mute/unmute, block list |
| **Bulk Operations** | ✅ Complete | Admin bulk actions on content/users |

## Engagement & Gamification

| Feature | Status | Endpoints |
|---------|--------|-----------|
| **XP System** | ✅ Complete | Earn XP for actions (post, like, comment, share) |
| **Daily Missions** | ✅ Complete | Daily tasks with progress tracking |
| **Streaks** | ✅ Complete | Consecutive day activity tracking |
| **Leaderboard** | ✅ Complete | Top users by XP, engagement |
| **Analytics** | ✅ Complete | Per-post stats, engagement trends, overview dashboard |

## Search & Discovery

| Feature | Status | Endpoints |
|---------|--------|-----------|
| **User Search** | ✅ Complete | Text index + regex fallback, cursor pagination |
| **Post Search** | ✅ Complete | Full-text + hashtag search, cursor pagination |
| **Message Search** | ✅ Complete | Within conversations, regex search |
| **Trending Hashtags** | ✅ Complete | Top 10 hashtags, 7-day window, 5min cache |
| **Suggested Users** | ✅ Complete | Affinity-based recommendations |
| **For You Feed** | ✅ Complete | Personalized content ranking |

## Technical Features

| Feature | Status | Details |
|---------|--------|---------|
| **Cursor Pagination** | ✅ 20+ endpoints | hasMore + nextCursor pattern |
| **Redis Caching** | ✅ Complete | Upstash Redis, TTL-based, SCAN-based pattern deletion |
| **Rate Limiting** | ✅ Complete | Global + per-route (Upstash Ratelimit) |
| **CSRF Protection** | ✅ Complete | Double-submit cookie pattern |
| **Helmet Security** | ✅ Complete | CSP, HSTS, XSS, content sniffing protection |
| **Graceful Shutdown** | ✅ Complete | SIGTERM/SIGINT, 30s timeout, clean disconnect |
| **Health Check** | ✅ Complete | MongoDB + Redis + memory + uptime |
| **Sentry Monitoring** | ✅ Complete | Error tracking + performance profiling |
| **Swagger Docs** | ✅ Complete | Auto-generated API documentation |
| **Request IDs** | ✅ Complete | UUID per request for tracing |
| **Sanitization** | ✅ Complete | HTML sanitization on user input |
| **Compression** | ✅ Complete | Gzip with 1KB threshold |

## Integration Points

| Integration | Status | Purpose |
|-------------|--------|---------|
| **Cloudinary** | ✅ Complete | Image/video upload & transformation |
| **ImageKit** | ✅ Complete | Image optimization CDN |
| **Upstash Redis** | ✅ Complete | Caching + rate limiting |
| **Socket.IO** | ✅ Complete | Real-time events + Redis adapter |
| **SMTP/Nodemailer** | ✅ Complete | Email (password reset, notifications) |
| **Sentry** | ✅ Complete | Error monitoring |
| **Web Push** | ✅ Complete | Browser push notifications (VAPID) |

## Pagination Coverage

All 20+ listing endpoints use cursor-based infinite scroll (`hasMore` + `nextCursor`):

- Posts (all, by author, by hashtag)
- Feed (ranked, for-you)
- Comments (by post, all, replies)
- Conversations & messages
- Notifications
- Followers & following lists
- Saved posts
- User search & post search
- Reposts
- Community messages
- Group messages
- Audio rooms (live)
- Collections
- Reports, moderation queue, analytics
- Glimpses (stories)
