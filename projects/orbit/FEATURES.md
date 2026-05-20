# Orbit — Features & How They Work

**Orbit** is a social blogging platform API. Users create accounts, publish posts with images, interact with each other, and get notified when something happens on their content. This document explains **what the app does** and **how each feature works** behind the scenes.

---

## Core idea

Think of Orbit like a lightweight social network focused on **posts** (short articles or updates):

- You **sign up** and build a **profile**
- You **publish posts** with text and an optional image
- Others can **like, comment, repost, save**, and **follow** you
- You receive **notifications** when people interact with your content
- You can **search** users and posts and **recover your password** by email

The backend stores data in **MongoDB**, speeds up reads with **Redis cache**, and stores images on **Cloudinary**.

---

## Authentication & accounts

### Sign up

1. User sends username, email, password, gender, and a **profile picture** (required file upload).
2. Server checks email/username are unique.
3. Password is **hashed** (never stored plain text).
4. Profile image goes to **Cloudinary**.
5. A **JWT** is created and stored in an **httpOnly cookie** (`jwt`) so the browser sends it automatically on later requests.
6. A **welcome email** is sent in the background.

### Login

1. User sends email + password.
2. If an old/invalid cookie exists, it is **cleared** and login continues.
3. If credentials match, a new JWT cookie is set (valid **7 days**).

### Logout

Clears the JWT cookie. Further API calls need login again.

### Update profile

Logged-in users can change bio, name, etc., and optionally upload a new **profile picture** or **banner** (both go to Cloudinary; old images are removed from Cloudinary when replaced).

### Delete account

User must confirm with their **password**. The account is removed and associated Cloudinary images are deleted. A confirmation email may be sent.

### Password reset (forgot password)

1. User requests OTP by email (`/api/password/request-otp`).
2. User submits OTP + new password (`/api/password/verify-and-forgot-password`).
3. Logged-in users can also change password from settings (`/api/password/update-password`).

---

## Posts

### Create a post

- Requires login.
- **Title** and **content** are validated (length limits).
- A **slug** is auto-generated from the title (unique URL-friendly id, e.g. `my-first-post`).
- Optional **image** uploaded to Cloudinary.
- Post is linked to the author; counters start at zero (likes, comments, views, etc.).

### Feed (all posts)

- **Public** — no login required to browse.
- Returns posts newest-first with **cursor pagination** (`limit` + `cursor` = last post id).
- Response is **cached in Redis** for 60 seconds to reduce database load.

### Single post

- Fetch one post by ID; also cached per post.

### Edit / delete post

- Only the **author** can update or delete.
- **Delete** removes the post image from Cloudinary and **cleans up related data**:
  - All comments on that post (including replies)
  - Likes on the post and on those comments
  - Reposts and saves of that post
  - Notifications tied to that post or its comments

### Views & shares

- **Views:** Anyone can hit the view endpoint (logged-in or anonymous). Count goes up once per request flow; optional auth via `protectViews`.
- **Shares:** Logged-in user triggers share; `sharesCount` increases. API returns a **share link** built from `CLIENT_URL` + post slug.

---

## Comments

### Read comments

- For a given post, loads **top-level comments** (not nested inline list of all depths in one flat sort — replies use `parent`).
- Paginated with cursor; cached per post.

### Add comment

- Logged-in user posts text on a post.
- Optional **`parent`** id → reply to another comment.
- Post’s `commentsCount` increases by 1.
- **Notifications:**
  - Post author is notified.
  - If it’s a reply, parent comment author is also notified (same person only gets **one** notification if they are both post author and parent author).

### Edit / delete comment

- Only the **author** can edit or delete.
- **Delete** removes the whole **thread** (that comment + all nested replies), all **likes** on those comments, and related **notifications**. Post `commentsCount` drops by the number of removed comments.

---

## Likes

### Like a post or comment

- Toggle: first request **likes**, second **unlikes**.
- Creates a `Like` record (user + post **or** user + comment).
- Updates `likesCount` on the post or comment.
- On **like**, sends a **notification** to the content owner (not if you like your own content).
- On **unlike**, removes that matching notification so the feed stays accurate.

---

## Follows

### Follow / unfollow

- Toggle follow between current user and target user.
- Cannot follow yourself.
- Updates `followersCount` on target and `followingCount` on current user.
- On follow, target user gets a **follow notification**; on unfollow, that notification is removed.

### Followers / following lists

- Public lists with pagination.
- Cached per user.

---

## Reposts

- Toggle repost on someone else’s post (cannot repost your own).
- Increases `repostsCount` on the post.
- On repost, post author gets a **repost notification**; on unrepost, it is removed.

---

## Saves (bookmarks)

- Toggle save on a post (bookmark).
- Increases `savesCount` on the post.
- On save, post author gets a **save notification**; on unsave, it is removed.
- **Saved posts list:** logged-in user can fetch all posts they saved (paginated, cached).

---

## Notifications

### When notifications are created

| Action          | Who gets notified                               |
| --------------- | ----------------------------------------------- |
| Like post       | Post author                                     |
| Like comment    | Comment author                                  |
| Comment / reply | Post author (+ parent author on reply, deduped) |
| Follow          | User being followed                             |
| Repost          | Post author                                     |
| Save            | Post author                                     |

Self-actions never notify (e.g. commenting on your own post).

### Reading notifications

- **List:** Newest first, paginated. Each item includes sender profile, post title/slug, comment snippet when relevant.
- **Unread count:** For badge on UI.
- **Mark all read:** Sets `isRead: true` on all your unread items.

Notifications are removed when:

- The related **post** or **comment thread** is deleted (cascade cleanup), or
- The user **reverses** the action (unlike, unfollow, unrepost, unsave).

---

## Search

- **Users:** Text search on user fields (requires login).
- **Posts:** MongoDB **text index** on title — search by query string (requires login).
- Both support a `limit` on results.

---

## How data stays in sync

### Counters on posts and profiles

Fields like `likesCount`, `commentsCount`, `followersCount` are stored on the document and updated with **`$inc`** when users interact. This makes feeds fast without counting every time. Under very heavy simultaneous use, counts could theoretically drift slightly (acceptable for v1).

### Caching

Frequently read lists (posts feed, comments, users, followers, saves) are stored in **Redis** for ~60 seconds. When someone writes (new post, comment, follow, etc.), relevant cache keys are **cleared** so the next read gets fresh data.

### Images

All uploads (signup photo, profile, banner, post image) go to **Cloudinary**. Deletes try to remove the Cloudinary file so storage does not fill with orphans.

---

## Security (how users are protected)

- Passwords hashed with **bcrypt**
- Auth token only in **httpOnly cookie** (not localStorage), reducing XSS token theft risk
- **CORS** limited to your frontend URL (`CLIENT_URL`)
- **Helmet** security headers
- **Rate limits** on login, OTP, comments, likes/follows, and notification reads
- **Env validation** at startup — server won’t run with missing secrets
- JSON body size capped (**100kb**)

---

## Typical user journey (example)

1. **Neon** signs up → profile + cookie set → welcome email.
2. **Neon** creates a post with an image → appears in public feed.
3. **Ben** logs in, sees the feed, likes the post → Neon gets a **like** notification.
4. **Ben** comments → Neon gets a **comment** notification; comment count = 1.
5. **Ben** follows Neon → Neon gets a **follow** notification.
6. **Ben** saves the post → Neon gets a **save** notification.
7. **Neon** opens notifications, sees unread count, marks all read.
8. **Neon** deletes the post → comments, likes, saves, reposts, and notifications for that post are cleaned up.

---

## What you need to run it

1. Fill `backend/.env` (MongoDB, JWT, Redis, Cloudinary, SMTP, `CLIENT_URL`).
2. `npm run dev` in `backend/`.
3. Frontend calls `http://localhost:5000/api/...` with **`credentials: "include"`**.

For the full route list, file structure, and tech tables, see **`PROJECT.md`**.

21 May 2026 | @indieDev | Panchajanya
