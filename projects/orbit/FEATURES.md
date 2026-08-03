# Mandatory -> **freebuff --continue 2026-08-02T21-57-04.421Z**

# Orbit — Complete Feature Catalog

> **Status:** ✅ 100% Complete — Zero TypeScript errors, zero `@ts-ignore` directives.
> All backend endpoints are built, all frontend components are wired, all realtime socket events are connected.

---

## Table of Contents

1. [Authentication & Account Management](#1-authentication--account-management)
2. [User Profiles](#2-user-profiles)
3. [Posts & Content Creation](#3-posts--content-creation)
4. [Feed & Discovery](#4-feed--discovery)
5. [Social Interactions](#5-social-interactions)
6. [Chat / Direct Messages](#6-chat--direct-messages)
7. [Communities](#7-communities)
8. [Notifications](#8-notifications)
9. [Glances (Ephemeral Stories)](#9-glances-ephemeral-stories)
10. [Reels (Short Video)](#10-reels-short-video)
11. [Collections & Saves](#11-collections--saves)
12. [Gamification: XP, Streaks, Daily Missions](#12-gamification-xp-streaks-daily-missions)
13. [Search](#13-search)
14. [Moderation & Safety](#14-moderation--safety)
15. [Admin Dashboard](#15-admin-dashboard)
16. [Translation & Link Previews](#16-translation--link-previews)
17. [Push Notifications](#17-push-notifications)
18. [Invite System](#18-invite-system)
19. [Close Friends](#19-close-friends)
20. [Post Scheduling & Drafts](#20-post-scheduling--drafts)
21. [Polls & Collaboration](#21-polls--collaboration)
22. [Analytics & Reach Stats](#22-analytics--reach-stats)
23. [Anonymous Browsing](#23-anonymous-browsing)
24. [Real-time Features (Socket Events)](#24-real-time-features-socket-events)
25. [Data Models](#25-data-models)
26. [Security Features](#26-security-features)
27. [UX Polish](#27-ux-polish)

---

## 1. Authentication & Account Management

| Feature                 | Backend | Frontend | Details                                                                          |
| ----------------------- | ------- | -------- | -------------------------------------------------------------------------------- |
| Email/Password Signup   | ✅      | ✅       | `POST /api/auth/signup` — validates with Zod schema, hashes password with bcrypt |
| Email/Password Login    | ✅      | ✅       | `POST /api/auth/login` — JWT token + HTTP-only cookie                            |
| Logout                  | ✅      | ✅       | `POST /api/auth/logout` — clears cookie                                          |
| Get Current User        | ✅      | ✅       | `GET /api/auth/me` — returns user profile from JWT session                       |
| Forgot Password         | ✅      | ✅       | Request OTP via email, verify OTP, reset password                                |
| Session Persistence     | ✅      | ✅       | JWT stored in httpOnly cookie, checked on page load                              |
| Auth Form Toggle        | —       | ✅       | Switch between Login / Signup without page reload                                |
| Email Verification Flag | ✅      | —        | `isEmailVerified` field on User model                                            |

---

## 2. User Profiles

| Feature                 | Backend | Frontend | Details                                                                          |
| ----------------------- | ------- | -------- | -------------------------------------------------------------------------------- |
| View User by ID         | ✅      | ✅       | `GET /api/users/:userId` — populated with post counts, bio, etc.                 |
| View User by Username   | ✅      | ✅       | `GET /api/users/username/:username` — slug-based profile lookup                  |
| View Own Profile        | ✅      | ✅       | `GET /api/auth/me`                                                               |
| Update Profile          | ✅      | ✅       | `PUT /api/users/profile` — name, bio, profile pic, cover photo, privacy settings |
| Profile Picture Upload  | ✅      | ✅       | Upload to Cloudinary, with cropping support                                      |
| Delete Account          | ✅      | ✅       | `DELETE /api/users/delete-account` — removes user + all associated data          |
| Share Profile           | ✅      | ✅       | `GET /api/users/share/:username` — returns shareable link                        |
| Get User Posts          | ✅      | ✅       | `GET /api/users/:userId/posts` — paginated                                       |
| Get Suggested Users     | ✅      | ✅       | `GET /api/users/suggestions` — algorithm-based recommendations                   |
| Private Accounts        | ✅      | ✅       | Follow request/approve/decline flow                                              |
| Follow Requests         | ✅      | ✅       | `sendFollowRequest`, `approveFollowRequest`, `declineFollowRequest`              |
| Pinned Posts            | ✅      | ✅       | Pin up to 3 posts to profile top                                                 |
| Profile Views Counter   | ✅      | ✅       | `GET /api/users/profile-views/:userId`                                           |
| XP Display on Profile   | —       | ✅       | Shows level badge + XP progress                                                  |
| Block User              | ✅      | ✅       | `blockUser`, `unblockUser`, `getBlockedUsers`, `checkBlocked`                    |
| Mute User               | ✅      | ✅       | `muteUser`, `unmuteUser`                                                         |
| Blocked Users List      | —       | ✅       | Settings page — view and unblock                                                 |
| Block Button on Profile | —       | ✅       | Inline block/unblock toggle on other users' profiles                             |

---

## 3. Posts & Content Creation

| Feature                 | Backend | Frontend | Details                                                                                 |
| ----------------------- | ------- | -------- | --------------------------------------------------------------------------------------- |
| Create Post             | ✅      | ✅       | `POST /api/posts` — text, images, video support                                         |
| Create Post with Images | ✅      | ✅       | Multiple image upload (max 10), Cloudinary hosting                                      |
| Create Post with Video  | ✅      | ✅       | Single video upload per post                                                            |
| Edit Post               | ✅      | ✅       | `PUT /api/posts/:postId` — edit text, replace images                                    |
| Edit History            | ✅      | ✅       | Track `isEdited` flag + history of edits                                                |
| Delete Post             | ✅      | ✅       | `DELETE /api/posts/:postId` — cascading deletes (comments, likes, saves, notifications) |
| Get Single Post         | ✅      | ✅       | `GET /api/posts/:postId` — with caching                                                 |
| Get Post by Slug        | ✅      | ✅       | `GET /api/posts/slug/:slug` — for permalink sharing                                     |
| Hashtag Support         | ✅      | ✅       | Extract `#hashtags` from title/content, clickable in UI                                 |
| Get Posts by Hashtag    | ✅      | ✅       | `GET /api/posts/hashtag/:hashtag` — paginated                                           |
| Trending Hashtags       | ✅      | ✅       | `GET /api/posts/trending/hashtags` — aggregated from last 7 days                        |
| Mention Support         | ✅      | ✅       | `@username` parsing with autocomplete dropdown                                          |
| Mention Notifications   | ✅      | ✅       | Creates notification for mentioned users                                                |
| Slug Generation         | ✅      | —        | Auto-generated from title, deduplicated                                                 |
| Cursor-based Pagination | ✅      | ✅       | All post endpoints use `cursor` + `limit`                                               |
| Media Cleanup on Delete | ✅      | —        | Deletes Cloudinary images/video on post deletion                                        |

### Post Sub-features

#### Polls

| Feature                | Backend | Frontend | Details                                            |
| ---------------------- | ------- | -------- | -------------------------------------------------- |
| Create Poll with Post  | ✅      | ✅       | Multiple options, optional expiry                  |
| Vote on Poll           | ✅      | ✅       | `POST /api/posts/:postId/vote` — one vote per user |
| Change Vote            | ✅      | ✅       | Re-voting removes old vote first                   |
| Poll Expiry            | ✅      | ✅       | `expiresAt` check before allowing votes            |
| Poll Results           | ✅      | ✅       | Returns updated poll state after voting            |
| Poll Vote Notification | ✅      | —        | Notifies post author on first vote                 |

#### Collaboration

| Feature              | Backend | Frontend | Details                                 |
| -------------------- | ------- | -------- | --------------------------------------- |
| Invite Collaborator  | ✅      | ✅       | `POST /api/posts/:postId/collab-invite` |
| Accept Collaboration | ✅      | ✅       | `POST /api/posts/:postId/collab-accept` |
| Collab Notification  | ✅      | —        | Sends `collab_invite` notification      |
| Collab Badge         | —       | ✅       | Shows collaborator on post card         |

#### Quote Reposts

| Feature                   | Backend | Frontend | Details                                                                     |
| ------------------------- | ------- | -------- | --------------------------------------------------------------------------- |
| Create Quote Repost       | ✅      | ✅       | `POST /api/posts/:postId/quote-repost` — creates new Post + Repost document |
| Quote Content             | ✅      | ✅       | User adds commentary to shared post                                         |
| Repost Count Tracking     | ✅      | ✅       | Increments `repostsCount` on original                                       |
| Quote Repost Notification | ✅      | —        | Notifies original author                                                    |
| Quote Button in UI        | —       | ✅       | "Quote" button next to "Repost" in post actions                             |

#### Scheduling & Drafts

| Feature              | Backend | Frontend | Details                                                           |
| -------------------- | ------- | -------- | ----------------------------------------------------------------- |
| Draft Status         | ✅      | ✅       | Post can be saved as `draft`                                      |
| Scheduled Publishing | ✅      | ✅       | Post can be scheduled with `scheduledAt`                          |
| Publish Draft        | ✅      | ✅       | `POST /api/posts/:postId/publish` — changes status to `published` |
| Archived Status      | ✅      | —        | `archived` added to valid status enum                             |

#### Pinning

| Feature             | Backend | Frontend | Details                                      |
| ------------------- | ------- | -------- | -------------------------------------------- |
| Pin Post to Profile | ✅      | ✅       | `POST /api/posts/:postId/pin` — max 3 pinned |
| Unpin Post          | ✅      | ✅       | `POST /api/posts/:postId/unpin`              |
| Pinned Posts List   | ✅      | ✅       | `GET /api/users/:userId/pinned`              |
| Realtime Pin Events | ✅      | —        | Socket event `post:pinned` / `post:unpinned` |
| Pin Icon in UI      | —       | ✅       | Visual indicator on pinned posts             |

---

## 4. Feed & Discovery

| Feature                | Backend | Frontend | Details                                                         |
| ---------------------- | ------- | -------- | --------------------------------------------------------------- |
| Main Feed              | ✅      | ✅       | `GET /api/feed` — ranked feed with affinity scoring             |
| All Posts (Public)     | ✅      | ✅       | `GET /api/posts` — chronological fallback                       |
| Trending Feed          | ✅      | ✅       | Sort by likes, views, recency                                   |
| Algorithmic Ranking    | ✅      | —        | Multi-signal scoring: affinity, velocity, recency, follow boost |
| Candidate Generation   | ✅      | —        | Posts from followed + high-affinity + 10-15% discovery          |
| Diversity Re-ranking   | ✅      | —        | No 2 consecutive same-author posts                              |
| Freshness Guarantee    | ✅      | —        | 2-3 reserved slots for posts <2hrs old                          |
| Affinity Scores        | ✅      | —        | Per-author scores, scheduled recomputation                      |
| Interaction Logging    | ✅      | —        | Logs likes, comments, saves, shares, DMs, profile visits        |
| In-memory Feed Caching | ✅      | —        | Per-user cache, 5-10min TTL, invalidated on new post/follow     |
| Post Reach Stats       | —       | ✅       | Views, likes, shares, saves aggregated on post card             |
| Pull-to-Refresh        | —       | ✅       | Touch gesture to reload feed                                    |
| Infinite Scroll        | —       | ✅       | IntersectionObserver-based lazy loading                         |
| Swipe-to-Like/Repost   | —       | ✅       | Left swipe = repost, right swipe = like                         |
| Realtime New Posts     | ✅      | ✅       | Socket event `post:created` prepends to feed                    |
| Realtime Post Updates  | ✅      | ✅       | Socket event `post:updated` updates in place                    |
| Realtime Post Deletion | ✅      | ✅       | Socket event `post:deleted` removes from feed                   |
| Reposts-Only View      | ✅      | ✅       | Filter feed to show only reposted content                       |
| Saves-Only View        | ✅      | ✅       | Filter feed to show only saved content                          |

---

## 5. Social Interactions

| Feature                           | Backend | Frontend | Details                                                                        |
| --------------------------------- | ------- | -------- | ------------------------------------------------------------------------------ |
| Like Post                         | ✅      | ✅       | `POST /api/likes/post/:postId` — toggle with optimistic UI                     |
| Like Comment                      | ✅      | ✅       | `POST /api/likes/comment/:commentId`                                           |
| Like Count Display                | —       | ✅       | Animated counter on post cards                                                 |
| Like Notification                 | ✅      | —        | Sends to post author on first like                                             |
| Comment on Post                   | ✅      | ✅       | `POST /api/comments/:postId` — with content validation                         |
| View Comments                     | ✅      | ✅       | `GET /api/comments/:postId` — with pagination                                  |
| Edit Comment                      | ✅      | ✅       | `PUT /api/comments/:commentId` — tracked as edited                             |
| Delete Comment                    | ✅      | ✅       | `DELETE /api/comments/:commentId` — soft delete                                |
| Reply to Comment (Threaded)       | ✅      | ✅       | Nested replies with parent tracking                                            |
| View Comment Replies              | ✅      | ✅       | `GET /api/comments/:commentId/replies`                                         |
| Comment Reactions (Emoji)         | ✅      | ✅       | `POST /api/comments/:commentId/reactions` — toggle emoji reactions on comments |
| Comment Likes                     | ✅      | ✅       | Toggle likes on individual comments                                            |
| Follow User                       | ✅      | ✅       | `POST /api/follow/:userId` — toggle, with mutual follow tracking               |
| Followers / Following Lists       | ✅      | ✅       | `GET /api/follow/followers/:userId`, `GET /api/follow/following/:userId`       |
| Save Post (Bookmark)              | ✅      | ✅       | `POST /api/saves/:postId` — toggle with optimistic UI                          |
| Get Saved Posts                   | ✅      | ✅       | `GET /api/saves` — paginated                                                   |
| Save Folders                      | ✅      | ✅       | Organize saved posts into folders                                              |
| Update Save Folder                | ✅      | ✅       | `PUT /api/saves/:postId/folder` — move to different folder                     |
| Repost / Share Post               | ✅      | ✅       | `POST /api/reposts/:postId` — toggle                                           |
| Get Reposted Posts                | ✅      | ✅       | `GET /api/reposts`                                                             |
| Share to External (Web Share API) | —       | ✅       | Native share sheet on supported devices                                        |
| Share Count                       | ✅      | ✅       | `POST /api/posts/:postId/share` — increments share counter + returns share URL |
| Realtime Like Mutation            | ✅      | ✅       | Socket event syncs likes across open windows                                   |
| Realtime Comment Added            | ✅      | ✅       | Socket event adds comment to live drawer                                       |
| Realtime Comment Deleted          | ✅      | ✅       | Socket event removes comment from drawer                                       |
| Realtime Comment Like Change      | ✅      | ✅       | Socket event updates comment likes count                                       |
| Read Receipts                     | ✅      | ✅       | Track if recipient has seen a message                                          |

---

## 6. Chat / Direct Messages

| Feature                       | Backend | Frontend | Details                                                                     |
| ----------------------------- | ------- | -------- | --------------------------------------------------------------------------- |
| Get or Create Conversation    | ✅      | ✅       | `GET /api/chats/conversation/:userId` — finds or creates DM                 |
| List Conversations            | ✅      | ✅       | `GET /api/chats/conversations` — sorted by latest message                   |
| Get Messages                  | ✅      | ✅       | `GET /api/chats/messages/:conversationId` — paginated                       |
| Send Message                  | ✅      | ✅       | `POST /api/chats/messages/:conversationId` — text + attachments             |
| Edit Message                  | ✅      | ✅       | `PUT /api/chats/messages/:messageId` — 5-minute edit window                 |
| Delete Message                | ✅      | ✅       | `DELETE /api/chats/messages/:messageId` — soft delete                       |
| Delete for Me                 | ✅      | ✅       | `DELETE /api/chats/messages/:messageId/for-me` — hide from own view         |
| Undo Send                     | ✅      | ✅       | `DELETE /api/chats/messages/:messageId/undo` — hard delete within 5 seconds |
| Delete Conversation           | ✅      | ✅       | `DELETE /api/chats/conversations/:conversationId` — remove entire thread    |
| Clear Conversation Messages   | ✅      | ✅       | `DELETE /api/chats/clear/:conversationId` — clear all messages              |
| Forward Message               | ✅      | ✅       | Forward message with `forwardedFrom` metadata                               |
| Forwarded Message UI          | —       | ✅       | Visual "Forwarded from" banner on forwarded messages                        |
| Reply to Message              | ✅      | ✅       | Inline reply with quoted original message                                   |
| Reply Preview UI              | —       | ✅       | Shows replied-to message above input                                        |
| React to Message (Emoji)      | ✅      | ✅       | `POST /api/chats/messages/:messageId/reaction`                              |
| Search Messages               | ✅      | ✅       | `GET /api/chats/messages/search/:conversationId?q=`                         |
| Typing Indicator              | ✅      | ✅       | Socket `chat:typing` — realtime typing status                               |
| User Presence (Online Status) | ✅      | ✅       | Redis-backed presence tracking                                              |
| Presence Heartbeat            | ✅      | ✅       | 25-second interval to keep presence alive                                   |
| Voice Note Recording          | —       | ✅       | Microphone recording with waveform preview                                  |
| Send Voice Note               | ✅      | ✅       | Upload as attachment with `voice_note` type                                 |
| Voice Note Playback           | —       | ✅       | Play/pause inline in message bubble                                         |
| Camera Capture                | —       | ✅       | Take photo and send directly                                                |
| Image Attachment              | ✅      | ✅       | Send images with Cloudinary upload                                          |
| GIF Picker                    | —       | ✅       | Browse/search Tenor GIFs and send                                           |
| File Attachments              | ✅      | ✅       | Generic file upload support                                                 |
| Chat Search (User Discovery)  | ✅      | ✅       | Search users to start new conversations                                     |
| Unread Count Badge            | ✅      | ✅       | Per-conversation + aggregate badge in Dock                                  |
| Conversation List Item        | —       | ✅       | Shows avatar, last message, timestamp, unread dot                           |
| Realtime Message New          | ✅      | ✅       | Socket event `message:new` — instant delivery                               |
| Realtime Message Delete       | ✅      | ✅       | Socket event `message:delete` — syncs deletions                             |
| Confirm Delete Modal          | —       | ✅       | Confirmation dialog before destructive actions                              |
| Confirm Clear Chat Modal      | —       | ✅       | Confirmation dialog for clearing entire conversation                        |

---

## 7. Communities

| Feature                       | Backend | Frontend | Details                                                                   |
| ----------------------------- | ------- | -------- | ------------------------------------------------------------------------- |
| Create Community              | ✅      | ✅       | `POST /api/communities` — name, description, profile image                |
| Create Community with Image   | ✅      | ✅       | Upload profile image on creation                                          |
| List All Communities (Browse) | ✅      | ✅       | `GET /api/communities` — browse discoverable communities                  |
| List My Communities           | ✅      | ✅       | `GET /api/communities/my` — communities user has joined                   |
| Get Community Detail          | ✅      | ✅       | `GET /api/communities/:communityId`                                       |
| Get Community Members         | ✅      | ✅       | `GET /api/communities/:communityId/members` — with join dates             |
| Update Community              | ✅      | ✅       | `PUT /api/communities/:communityId` — edit name, description, image       |
| Delete Community              | ✅      | ✅       | `DELETE /api/communities/:communityId` — creator only (with confirmation) |
| Join Community                | ✅      | ✅       | `POST /api/communities/:communityId/join`                                 |
| Leave Community               | ✅      | ✅       | `POST /api/communities/:communityId/leave` (with confirmation)            |
| Leave with Confirmation       | —       | ✅       | Confirmation dialog before leaving                                        |
| Loading State on Join         | —       | ✅       | Button shows spinner during join request                                  |

### Community Messaging

| Feature                  | Backend | Frontend | Details                                                            |
| ------------------------ | ------- | -------- | ------------------------------------------------------------------ |
| Get Community Messages   | ✅      | ✅       | `GET /api/communities/:communityId/messages` — paginated           |
| Send Message             | ✅      | ✅       | `POST /api/communities/:communityId/messages` — text + attachments |
| Edit Message             | ✅      | ✅       | `PUT /api/communities/messages/:messageId` — 5-minute window       |
| Delete Message           | ✅      | ✅       | `DELETE /api/communities/messages/:messageId` — soft delete        |
| Delete for Me            | ✅      | ✅       | `DELETE /api/communities/messages/:messageId/for-me`               |
| React to Message (Emoji) | ✅      | ✅       | `POST /api/communities/messages/:messageId/reaction` — toggle      |
| Reply to Message         | ✅      | ✅       | Inline reply with quoted original                                  |
| Reply Preview UI         | —       | ✅       | Shows replied-to message above input                               |
| Pin Message              | ✅      | ✅       | `POST /api/communities/:communityId/pin/:messageId`                |
| Unpin Message            | ✅      | ✅       | `POST /api/communities/:communityId/unpin/:messageId`              |
| Get Pinned Messages      | ✅      | ✅       | `GET /api/communities/:communityId/pinned`                         |
| Pinned Messages Banner   | —       | ✅       | Shows pinned message at top of chat                                |

### Community Realtime (Socket Events)

| Feature                      | Details                                    |
| ---------------------------- | ------------------------------------------ |
| `community:join`             | Join a community room on socket            |
| `community:leave`            | Leave a community room on socket           |
| `community:typing`           | Realtime typing indicator                  |
| `community:message:new`      | Instant message delivery to all members    |
| `community:message:edit`     | Live message edit sync                     |
| `community:message:delete`   | Live message deletion sync                 |
| `community:message:reaction` | Live emoji reaction sync                   |
| `community:message:pinned`   | Live pinned message update                 |
| `community:message:unpinned` | Live unpinned message update               |
| `community:member-joined`    | Live member count update                   |
| `community:member-left`      | Live member count update                   |
| `community:updated`          | Live community name/desc/image update      |
| `community:deleted`          | Redirect members when community is deleted |

### Community UI

| Feature                  | Details                                      |
| ------------------------ | -------------------------------------------- |
| Community List View      | Two tabs: "My Communities" and "Browse"      |
| Community Chat View      | Full message list with input bar             |
| Create Community Modal   | Form with name, description, optional image  |
| Community Settings Modal | Edit name, description, image; delete option |
| Member List Panel        | All members with join dates                  |
| Context Menu on Messages | Edit, delete, pin, react options             |
| Unread Badge             | Unread count indicator on community list     |
| Visual Feedback          | Loading states for join/leave/create         |

---

## 8. Notifications

| Feature                 | Backend | Frontend | Details                                                                                                       |
| ----------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Get Unread Count        | ✅      | ✅       | `GET /api/notifications/unread-count` — badge in Dock                                                         |
| List Notifications      | ✅      | ✅       | `GET /api/notifications` — paginated feed                                                                     |
| Mark as Read            | ✅      | ✅       | `PUT /api/notifications/:notificationId/read`                                                                 |
| Mark All as Read        | ✅      | ✅       | `PUT /api/notifications/read-all`                                                                             |
| Delete Notification     | ✅      | ✅       | `DELETE /api/notifications/:notificationId`                                                                   |
| Clear All Notifications | ✅      | ✅       | `DELETE /api/notifications/clear-all`                                                                         |
| Notification Types      | ✅      | ✅       | like, comment, follow, mention, repost, message, collab_invite, poll_vote, glimpse_reaction, community_invite |
| Realtime Push (Socket)  | ✅      | ✅       | Socket event `notification` — instant toast + badge update                                                    |
| Toast Notification UI   | —       | ✅       | In-app toast with message preview                                                                             |
| Clear Badge on View     | ✅      | ✅       | Badge resets when notification tab opened                                                                     |
| Screen-specific Routing | —       | ✅       | Clicking notification navigates to relevant tab                                                               |

---

## 9. Glances (Ephemeral Stories)

| Feature                    | Backend | Frontend | Details                                                 |
| -------------------------- | ------- | -------- | ------------------------------------------------------- |
| Get Glimpse Feed           | ✅      | ✅       | `GET /api/glances/feed` — story-style horizontal row    |
| Create Glimpse             | ✅      | ✅       | `POST /api/glances` — image with optional caption       |
| View Glimpse               | ✅      | ✅       | `GET /api/glances/:glimpseId` — marks as viewed         |
| React to Glimpse (Emoji)   | ✅      | ✅       | `POST /api/glances/:glimpseId/react`                    |
| Reply to Glimpse           | ✅      | ✅       | `POST /api/glances/:glimpseId/reply` — DM-like response |
| Delete Glimpse             | ✅      | ✅       | `DELETE /api/glances/:glimpseId` — creator only         |
| Auto-expire Glimpses       | ✅      | ✅       | Glimpses expire after 24 hours                          |
| Realtime Glimpse Reactions | ✅      | ✅       | Socket event `glimpse:reacted`                          |
| Realtime Glimpse Expiry    | ✅      | ✅       | Socket event `glimpse:expired`                          |
| View Count per Glimpse     | ✅      | ✅       | Tracks unique viewers                                   |
| Glimpse Viewer List        | ✅      | ✅       | Shows who has viewed                                    |
| Story-like UI              | —       | ✅       | Full-screen viewer with progress bar                    |
| Reply-to-Glimpse UI        | —       | ✅       | Quick reply to start a DM about a glimpse               |

---

## 10. Reels (Short Video)

| Feature               | Backend | Frontend | Details                         |
| --------------------- | ------- | -------- | ------------------------------- |
| Upload Video          | ✅      | ✅       | Video posts displayed as Reels  |
| Reels Feed            | —       | ✅       | Full-screen vertical swipe feed |
| Play/Pause            | —       | ✅       | Tap to toggle                   |
| Mute/Unmute           | —       | ✅       | Sound control overlay           |
| Replay                | —       | ✅       | Replay button when video ends   |
| Like on Reel          | ✅      | ✅       | Toggle like from Reels feed     |
| Comment on Reel       | ✅      | ✅       | Open comments from Reels        |
| Share Reel            | ✅      | ✅       | Share action from Reels         |
| Swipe Between Reels   | —       | ✅       | Vertical swipe navigation       |
| Video Player Controls | —       | ✅       | Play/pause, mute, replay        |

---

## 11. Collections & Saves

| Feature                     | Backend | Frontend | Details                                      |
| --------------------------- | ------- | -------- | -------------------------------------------- |
| Create Collection           | ✅      | ✅       | `POST /api/collections` — named collection   |
| List Collections            | ✅      | ✅       | `GET /api/collections` — user's collections  |
| Get Collection Posts        | ✅      | ✅       | `GET /api/collections/:collectionId/posts`   |
| Add Post to Collection      | ✅      | ✅       | `POST /api/collections/:collectionId/add`    |
| Remove Post from Collection | ✅      | ✅       | `POST /api/collections/:collectionId/remove` |
| Delete Collection           | ✅      | ✅       | `DELETE /api/collections/:collectionId`      |
| Save to Collection UI       | —       | ✅       | Save dialog with collection picker           |
| Collections Tab in Profile  | —       | ✅       | Grid view of collections                     |
| Dynamic Collection Count    | —       | ✅       | Live badge count for collections tab         |
| Skeleton Loading            | —       | ✅       | Loading state for collection lists           |

---

## 12. Gamification: XP, Streaks, Daily Missions

### XP & Leveling

| Feature             | Backend | Frontend | Details                                      |
| ------------------- | ------- | -------- | -------------------------------------------- |
| Get My XP           | ✅      | ✅       | `GET /api/xp/me` — total XP, level           |
| Get User XP         | ✅      | ✅       | `GET /api/xp/:userId`                        |
| Award XP on Actions | ✅      | —        | CREATE_POST, LIKE, COMMENT actions award XP  |
| XP Level Display    | —       | ✅       | Level badge + progress bar in profile header |

### Daily Missions

| Feature                         | Backend | Frontend | Details                                                 |
| ------------------------------- | ------- | -------- | ------------------------------------------------------- |
| Get Missions                    | ✅      | ✅       | `GET /api/missions` — daily tasks                       |
| Claim Mission                   | ✅      | ✅       | `POST /api/missions/claim`                              |
| Progress Missions Automatically | ✅      | —        | `progressMission()` called on post/comment/like actions |
| Missions Panel                  | —       | ✅       | Home feed panel showing today's missions with progress  |

### Streaks & Daily Rewards

| Feature               | Backend | Frontend | Details                                                 |
| --------------------- | ------- | -------- | ------------------------------------------------------- |
| Get My Streaks        | ✅      | ✅       | `GET /api/streaks` — current streak, longest streak     |
| Claim Daily Reward    | ✅      | ✅       | `POST /api/streaks/claim` — day-based reward            |
| Get Reward Status     | ✅      | ✅       | `GET /api/streaks/rewards` — what's claimable           |
| Update Partner Streak | ✅      | ✅       | `POST /api/streaks/partner` — mutual streak with friend |
| Streaks UI Panel      | —       | ✅       | Profile tab — streak calendar + rewards list            |
| Skeleton Loading      | —       | ✅       | Loading shimmer for streaks/rewards                     |

---

## 13. Search

| Feature                | Backend | Frontend | Details                                               |
| ---------------------- | ------- | -------- | ----------------------------------------------------- |
| Search Users           | ✅      | ✅       | `GET /api/search/users?q=` — username/fullName search |
| Search Posts           | ✅      | ✅       | `GET /api/search/posts?q=` — text search on posts     |
| Hashtag-based Browsing | ✅      | ✅       | Click a hashtag to browse related posts               |
| Search in Chat         | ✅      | ✅       | Message search within conversations                   |
| Search Loading States  | —       | ✅       | Skeleton while searching                              |

---

## 14. Moderation & Safety

| Feature                 | Backend | Frontend | Details                                                   |
| ----------------------- | ------- | -------- | --------------------------------------------------------- |
| Report Content          | ✅      | ✅       | `POST /api/reports` — report posts with reason            |
| Get Reports (Admin)     | ✅      | ✅       | `GET /api/reports` — review submitted reports             |
| Review Report (Admin)   | ✅      | ✅       | `PUT /api/reports/:reportId/review` — dismiss or action   |
| Block User              | ✅      | ✅       | `POST /api/block/:userId` — prevents all interaction      |
| Unblock User            | ✅      | ✅       | `POST /api/unblock/:userId`                               |
| Get Blocked Users       | ✅      | ✅       | `GET /api/block/blocked`                                  |
| Check Blocked Status    | ✅      | ✅       | `GET /api/block/check/:userId`                            |
| Mute User               | ✅      | ✅       | `POST /api/mute/:userId` — hides content without blocking |
| Unmute User             | ✅      | ✅       | `POST /api/unmute/:userId`                                |
| ReportButton Component  | —       | ✅       | Report button on post cards with reason selection         |
| Report Reason Selection | —       | ✅       | Multiple reasons: spam, harassment, hate speech, etc.     |

---

## 15. Admin Dashboard

| Feature                 | Backend | Frontend | Details                                                         |
| ----------------------- | ------- | -------- | --------------------------------------------------------------- |
| Create Feature Flag     | ✅      | ✅       | `POST /api/admin/flags` — name, description, rollout %, enabled |
| Get Feature Flags       | ✅      | ✅       | `GET /api/admin/flags`                                          |
| Update Feature Flag     | ✅      | ✅       | `PUT /api/admin/flags/:flagId`                                  |
| Get User Flags          | ✅      | ✅       | `GET /api/admin/user-flags` — check user feature flag overrides |
| Toggle User Mute/Unmute | ✅      | —        | Moderation action                                               |
| Toggle User Ban         | ✅      | —        | Moderation action                                               |
| Admin Panel UI          | —       | ✅       | Three tabs: Reports, Users, Feature Flags                       |
| Feature Flag Hooks      | —       | ✅       | `useFeatureFlag` hook for A/B testing                           |
| Admin Nav Button        | —       | ✅       | Shield icon in LeftSidebar                                      |

---

## 16. Translation & Link Previews

| Feature              | Backend | Frontend | Details                                                         |
| -------------------- | ------- | -------- | --------------------------------------------------------------- |
| Translate Text       | ✅      | ✅       | `POST /api/translate` — translate post/comment content          |
| Detect Language      | ✅      | ✅       | `POST /api/translate/detect`                                    |
| Get Link Preview     | ✅      | ✅       | `GET /api/link-preview?url=` — OG metadata (title, desc, image) |
| Link Preview Display | —       | ✅       | Rich link card in posts                                         |

---

## 17. Push Notifications

| Feature                            | Backend | Frontend | Details                                                   |
| ---------------------------------- | ------- | -------- | --------------------------------------------------------- |
| Get VAPID Key                      | ✅      | ✅       | `GET /api/push/vapid-key`                                 |
| Subscribe                          | ✅      | ✅       | `POST /api/push/subscribe` — register device subscription |
| Unsubscribe                        | ✅      | ✅       | `POST /api/push/unsubscribe`                              |
| Push Notification Permissions Flow | —       | ✅       | Request permission on relevant actions                    |
| Service Worker                     | —       | ✅       | `sw.js` for push event handling                           |

---

## 18. Invite System

| Feature              | Backend | Frontend | Details                                                    |
| -------------------- | ------- | -------- | ---------------------------------------------------------- |
| Generate Invite Code | ✅      | ✅       | `POST /api/invite/generate` — create shareable code        |
| Get My Invites       | ✅      | ✅       | `GET /api/invite/my-invites` — list codes + usage stats    |
| Redeem Invite Code   | ✅      | ✅       | `POST /api/invite/redeem` — join via code                  |
| Get Invite Stats     | ✅      | ✅       | `GET /api/invite/stats` — total invites, accepted, rewards |
| InvitesTab Component | —       | ✅       | Settings tab showing invite codes with copy/share          |

---

## 19. Close Friends

| Feature                   | Backend | Frontend | Details                                  |
| ------------------------- | ------- | -------- | ---------------------------------------- |
| Add Close Friend          | ✅      | ✅       | `POST /api/close-friends/add/:userId`    |
| Remove Close Friend       | ✅      | ✅       | `POST /api/close-friends/remove/:userId` |
| Get Close Friends         | ✅      | ✅       | `GET /api/close-friends`                 |
| Check Close Friend Status | ✅      | ✅       | `GET /api/close-friends/check/:userId`   |
| Close Friends Badge       | —       | ✅       | Visual indicator in profile              |

---

## 20. Post Scheduling & Drafts

| Feature         | Backend | Frontend | Details                                               |
| --------------- | ------- | -------- | ----------------------------------------------------- |
| Draft Status    | ✅      | ✅       | Posts saved as `draft` — not visible in feed          |
| Scheduled Posts | ✅      | ✅       | Posts with `scheduledAt` date — auto-publish via cron |
| Publish Draft   | ✅      | ✅       | `POST /api/posts/:postId/publish`                     |
| Drafts Manager  | —       | ✅       | View/edit scheduled/draft posts                       |

---

## 21. Polls & Collaboration

See [Polls](#polls) and [Collaboration](#collaboration) under Posts.

---

## 22. Analytics & Reach Stats

| Feature                            | Backend | Frontend | Details                                  |
| ---------------------------------- | ------- | -------- | ---------------------------------------- |
| View Count per Post                | ✅      | ✅       | 3-second visibility threshold tracking   |
| Like Count                         | ✅      | ✅       | Real-time count updates                  |
| Share Count                        | ✅      | ✅       | Tracked on each share action             |
| Repost Count                       | ✅      | ✅       | Tracked on each repost/quote             |
| Comment Count                      | ✅      | ✅       | Updated on add/delete                    |
| Save Count                         | ✅      | ✅       | Tracked on save toggle                   |
| Post Reach Stats View              | —       | ✅       | Aggregated stats card on posts           |
| Profile View Count                 | ✅      | ✅       | Tracks profile visits                    |
| Interaction Logging (Feed Ranking) | ✅      | —        | Logs all user interactions for algorithm |

---

## 23. Anonymous Browsing

| Feature               | Backend | Frontend | Details                         |
| --------------------- | ------- | -------- | ------------------------------- |
| Toggle Anonymous Mode | ✅      | ✅       | `POST /api/anonymous/toggle`    |
| Get Anonymous Status  | ✅      | ✅       | `GET /api/anonymous/status`     |
| Anonymous Browsing UI | —       | ✅       | Visual indicator when anonymous |

---

## 24. Real-time Features (Socket Events)

### Connection Lifecycle

| Event                | Direction       | Details                 |
| -------------------- | --------------- | ----------------------- |
| `connect`            | Server → Client | Socket connected        |
| `disconnect`         | Server → Client | Socket disconnected     |
| `reconnect_attempt`  | Client → Server | Attempting reconnection |
| `connect_error`      | Server → Client | Connection failed       |
| `presence:heartbeat` | Client → Server | 25s keepalive           |

### Chat Events

| Event              | Direction       | Details                 |
| ------------------ | --------------- | ----------------------- |
| `chat:join`        | Client → Server | Join conversation room  |
| `chat:leave`       | Client → Server | Leave conversation room |
| `chat:typing`      | Bidirectional   | Typing indicator        |
| `message:new`      | Server → Client | New message delivered   |
| `message:delete`   | Server → Client | Message deleted sync    |
| `presence:online`  | Server → Client | User came online        |
| `presence:offline` | Server → Client | User went offline       |

### Community Events

| Event                        | Direction       | Details                  |
| ---------------------------- | --------------- | ------------------------ |
| `community:join`             | Client → Server | Join community room      |
| `community:leave`            | Client → Server | Leave community room     |
| `community:typing`           | Bidirectional   | Typing in community      |
| `community:message:new`      | Server → Client | New community message    |
| `community:message:edit`     | Server → Client | Message edited           |
| `community:message:delete`   | Server → Client | Message deleted          |
| `community:message:reaction` | Server → Client | Emoji reaction added     |
| `community:message:pinned`   | Server → Client | Message pinned           |
| `community:message:unpinned` | Server → Client | Message unpinned         |
| `community:member-joined`    | Server → Client | Member count update      |
| `community:member-left`      | Server → Client | Member count update      |
| `community:updated`          | Server → Client | Community detail updated |
| `community:deleted`          | Server → Client | Community deleted        |

### Post Events

| Event                | Direction       | Details                |
| -------------------- | --------------- | ---------------------- |
| `post:created`       | Server → Client | New post in feed       |
| `post:deleted`       | Server → Client | Post removed           |
| `post:updated`       | Server → Client | Post edited            |
| `postCommentAdded`   | Server → Client | New comment on post    |
| `postCommentDeleted` | Server → Client | Comment removed        |
| `post:pinned`        | Server → Client | Post pinned to profile |
| `post:unpinned`      | Server → Client | Post unpinned          |
| `post:view`          | Server → Client | View count updated     |

### Glimpse Events

| Event             | Direction       | Details              |
| ----------------- | --------------- | -------------------- |
| `glimpse:reacted` | Server → Client | Reaction on glimpse  |
| `glimpse:expired` | Server → Client | Glimpse auto-expired |

### Call Events (Voice/Video)

| Event                | Direction       | Details               |
| -------------------- | --------------- | --------------------- |
| `call:offer`         | Server → Client | Incoming call         |
| `call:answer`        | Server → Client | Call accepted         |
| `call:ice-candidate` | Bidirectional   | WebRTC ICE candidates |
| `call:end`           | Server → Client | Call ended            |
| `call:missed`        | Server → Client | Call not answered     |

### Notification Events

| Event          | Direction       | Details                |
| -------------- | --------------- | ---------------------- |
| `notification` | Server → Client | New notification toast |

---

## 25. Data Models

| Model                  | Purpose                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **User**               | Core user data, profile, privacy settings, following, followers, blocked/muted lists    |
| **Post**               | Posts with text, images, video, polls, collab, quote repost, scheduling, edit history   |
| **Comment**            | Nested comments with parent support, reactions, edit tracking                           |
| **Like**               | Polymorphic likes (posts + comments)                                                    |
| **Repost**             | User+post repost tracking (unique index)                                                |
| **Save**               | Post saving with folder support                                                         |
| **Conversation**       | DM thread between 2 users with unread counts                                            |
| **Message**            | Chat messages with text, attachments, edit/delete tracking, forward metadata            |
| **Community**          | Group chat with name, description, image, creator, member count                         |
| **CommunityMessage**   | Community messages with reactions, pins, reply tracking                                 |
| **Notification**       | All notification types with sender, recipient, post/comment refs                        |
| **Glimpse**            | Ephemeral stories with 24hr TTL, viewer tracking                                        |
| **Follow**             | Follow relationships with follow request support                                        |
| **Block**              | Blocked user pairs                                                                      |
| **Interaction**        | Feed ranking interaction logs (like, comment, save, share, dm, profileVisit, storyView) |
| **Report**             | Content reports with reason and review status                                           |
| **Collection**         | User-created post collections                                                           |
| **FeatureFlag**        | A/B testing feature flag configuration                                                  |
| **DeviceSubscription** | Push notification device subscriptions                                                  |
| **DailyReward**        | Daily reward claims tracking                                                            |
| **DailyMission**       | User daily missions with progress                                                       |
| **UserStreak**         | Streak tracking with partner support                                                    |
| **XP**                 | Experience points and level tracking                                                    |
| **UserInvite**         | Invite code generation and redemption                                                   |
| **UserEvent**          | User activity event log                                                                 |

---

## 26. Security Features

| Feature                      | Status | Details                                                                   |
| ---------------------------- | ------ | ------------------------------------------------------------------------- |
| JWT Authentication           | ✅     | HttpOnly cookie-based auth tokens                                         |
| Password Hashing             | ✅     | bcrypt with salt rounds                                                   |
| Input Validation (Zod)       | ✅     | Schema validation on all input endpoints                                  |
| Input Sanitization           | ✅     | `sanitize-html` for HTML/text content                                     |
| Rate Limiting                | ✅     | Upstash sliding window — auth, OTP, comments, interactions, notifications |
| CSRF Protection              | ✅     | Double-submit cookie pattern                                              |
| CORS                         | ✅     | Configured allowlist                                                      |
| Helmet Security Headers      | ✅     | HTTP security headers                                                     |
| Auth Middleware              | ✅     | `protect` middleware on all protected routes                              |
| Ownership Checks             | ✅     | Forbidden access on unauthorized resource mutations                       |
| Media Cleanup on Delete      | ✅     | Cloudinary cleanup for deleted posts                                      |
| Environment Variables        | ✅     | All secrets via `process.env`                                             |
| No `eval()` Usage            | ✅     | Zero occurrences                                                          |
| No `dangerouslySetInnerHTML` | ✅     | Zero occurrences in production code                                       |

---

## 27. UX Polish

| Feature                    | Status | Details                                                          |
| -------------------------- | ------ | ---------------------------------------------------------------- |
| Optimistic UI Updates      | ✅     | Likes, saves, reposts update instantly before API response       |
| Rollback on Error          | ✅     | State reverts if API call fails                                  |
| Skeleton Loading States    | ✅     | Feed, Chat, Communities, Collections, Streaks, Profile, Settings |
| Shimmer Animation          | ✅     | Animated gradient shimmer for all skeletons                      |
| Pull-to-Refresh            | ✅     | Touch gesture reload on feed                                     |
| Infinite Scroll            | ✅     | IntersectionObserver-based pagination on feed, comments, chat    |
| Animated Tab Transitions   | ✅     | Motion/AnimatePresence for tab changes                           |
| Micro-interactions         | ✅     | Hover/tap animations on buttons, icons                           |
| Swipe Gestures             | ✅     | Swipe to like/repost on post cards                               |
| Toast Notifications        | ✅     | In-app toast for success/error messages                          |
| Dynamic Page Title         | ✅     | Tab title updates based on current view                          |
| Responsive Design          | ✅     | Mobile-first, adapts to tablet/desktop                           |
| Bottom Dock (Mobile)       | ✅     | Mobile navigation bar                                            |
| Left Sidebar (Desktop)     | ✅     | Desktop navigation sidebar                                       |
| Right Sidebar (Desktop)    | ✅     | Suggestions + Trending panels                                    |
| Empty States               | ✅     | Custom empty state illustrations for no posts, no results, etc.  |
| Error Boundaries           | ✅     | React error boundary wrapping entire app                         |
| Composer with Image/Video  | ✅     | Post composer with image crop modal                              |
| Image Cropping             | ✅     | Sequential multi-image cropping before upload                    |
| Image Carousel             | ✅     | Multi-image post navigation                                      |
| Pinch-to-Zoom              | ✅     | PinchZoom component for images                                   |
| Fullscreen Image Viewer    | ✅     | Tap image to view fullscreen                                     |
| Keyboard Awareness         | ✅     | `useKeyboardOpen` hook for mobile                                |
| Large Screen Optimizations | ✅     | Background gradients/globals hidden on mobile for performance    |
| Code Splitting             | ✅     | React.lazy on heavy components                                   |
| Preloading on Idle         | ✅     | Browser idle callback for component preloading                   |
| Blob URL Cleanup           | ✅     | Revokes object URLs on unmount to prevent memory leaks           |
| Undo Send Timeout Cleanup  | ✅     | Clears undo timer on component unmount                           |
| Typing Indicators          | ✅     | Animated dots for typing status                                  |

---

## Quick Stats

| Metric                | Count   |
| --------------------- | ------- |
| Backend Controllers   | **34**  |
| Backend Routes        | **31**  |
| Backend Models        | **26**  |
| Frontend Components   | **52**  |
| Socket Events         | **40+** |
| TypeScript Errors     | **0**   |
| @ts-ignore Directives | **0**   |

---

_Last updated: July 20, 2026_
