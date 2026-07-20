# Orbit API Testing Report

> **Test Date:** July 20, 2026
> **Server:** Running on PORT 5006 (MongoDB Atlas)
> **Auth:** JWT Bearer token + CSRF double-submit cookie pattern
> **Tools:** curl with cookies jar + JWT token + CSRF header

---

## ✅ Working Features (Tested Successfully)

| # | Feature | Endpoint | Status | Notes |
|---|---------|----------|--------|-------|
| 1 | Signup | `POST /api/auth/signup` | ✅ | Creates user, returns JWT, sets cookies |
| 2 | Login | `POST /api/auth/login` | ✅ | Uses `usernameOrEmail` field + `password` |
| 3 | Session Check | `GET /api/auth/me` | ✅ | Returns full user profile |
| 4 | User Suggestions | `GET /api/users/suggestions` | ✅ | Returns 5 suggested users to follow |
| 5 | User by Username | `GET /api/users/username/:username` | ✅ | Returns user public profile |
| 6 | Search Users | `GET /api/search/users?q=` | ✅ | Paginated, found 2 users for "test" |
| 7 | Search Posts | `GET /api/search/posts?q=` | ✅ | Returns matching posts |
| 8 | Create Post | `POST /api/posts` | ✅ | Requires CSRF token + multipart or JSON |
| 9 | Get All Posts | `GET /api/posts` | ✅ | Paginated with post details |
| 10 | Like Post | `POST /api/likes/post/:postId` | ✅ | Toggle like/unlike |
| 11 | Save Post | `POST /api/saves/:postId` | ✅ | Toggle save/unsave |
| 12 | Get Saved Posts | `GET /api/saves` | ✅ | Returns saved posts list |
| 13 | Add Comment | `POST /api/comments/:postId` | ✅ | Uses `content` field |
| 14 | Get Comments | `GET /api/comments/:postId` | ✅ | Returns comments array |
| 15 | Follow User | `POST /api/follows/:userId` | ✅ | Toggle follow/unfollow |
| 16 | Get Followers | `GET /api/follows/:userId/followers` | ✅ | Paginated |
| 17 | Get Following | `GET /api/follows/:userId/following` | ✅ | Paginated |
| 18 | Create Conversation | `POST /api/chats/conversations` | ✅ | Uses `recipientId` + `initialMessage` |
| 19 | Get Conversations | `GET /api/chats/conversations` | ✅ | Returns conversations list |
| 20 | Create Community | `POST /api/communities` | ✅ | Works with JSON or multipart (with image) |
| 21 | Browse Communities | `GET /api/communities` | ✅ | Paginated with member counts |
| 22 | My Communities | `GET /api/communities/mine` | ✅ | Returns user's joined communities |
| 23 | Notifications | `GET /api/notifications` | ✅ | Returns notification list |
| 24 | Unread Count | `GET /api/notifications/unread-count` | ✅ | Returns count |
| 25 | My Streak | `GET /api/streaks/my` | ✅ | Returns streak data |
| 26 | Streak Reward | `GET /api/streaks/reward` | ✅ | Returns next reward info |
| 27 | My XP | `GET /api/xp` | ✅ | Returns XP + level |
| 28 | Admin Flags (mine) | `GET /api/admin/flags/mine` | ✅ | Returns feature flags |
| 29 | Audio Rooms Live | `GET /api/rooms/live` | ✅ | Returns live rooms |
| 30 | Leaderboard | `GET /api/leaderboard` | ✅ | Returns top posts + creators |
| 31 | Feed | `GET /api/feed?limit=5` | ✅ | Returns ranked feed (empty initially) |
| 32 | Trending Hashtags | `GET /api/posts/trending/hashtags` | ✅ | Returns trending tags |

---

## 🔴 Critical Issues Found

### Issue 1: Collection Create — Internal Server Error
**Endpoint:** `POST /api/collections`
**Error:** `Cannot destructure property 'name' of 'req.body' as it is undefined`
**Root Cause:** The route handler likely has multer middleware expecting file upload, which strips JSON body when no file is attached. Even with `multipart/form-data`, the issue persists.
**Impact:** Users cannot create collections.
**Fix Required:** In `collection.controllers.ts`, line 19: `const { name } = req.body;` — req.body is undefined because multer middleware processes the request but doesn't populate body when no file is uploaded. Need to either:
- Use a non-multer route for JSON-only requests, or
- Add `none()` multer instance, or
- Parse body before multer processes it.

---

### Issue 2: Get Saved Posts — `savedByMe` field incorrect
**Endpoint:** `GET /api/saves`
**Description:** After saving a post (`POST /api/saves/:postId` returns `savedByMe: true`), the `GET /api/saves` endpoint returns `savedByMe: false` for the same post.
**Impact:** UI shows incorrect save state on the saves list view.
**Fix Required:** The save query likely returns posts with `savedByMe` defaulting to false instead of computing it from the user's actual saves.

---

### Issue 3: Daily Missions Route — 404 Not Found
**Endpoint:** `GET /api/dailyMission/today` (also tried `GET /api/daily-mission/today`)
**Error:** `Route /api/dailyMission/today not found!`
**Root Cause:** The route file (`dailyMission.routes.ts`) might use a different mount path, or the routes aren't registered in `server.ts`.
**Impact:** Users cannot access daily missions feature.
**Fix Required:** Check route mounting in `server.ts` and the route path in `routes/dailyMission.routes.ts`.

---

### Issue 4: Community Create with JSON Body — Fails
**Endpoint:** `POST /api/communities` (with `Content-Type: application/json`)
**Error:** `Cannot destructure property 'name' of 'req.body' as it is undefined`
**Root Cause:** The route has multer middleware for optional profile image, but multer's `none()` isn't used for JSON-only requests. The multer middleware processes the request and clears `req.body` when no multipart data is present.
**Impact:** Inconsistency — some endpoints work with JSON, some require multipart.
**Fix Required:** Use separate routes or configure multer to pass through JSON body when no file is uploaded.

---

### Issue 5: Repost Own Post — Prevented (Expected but Confusing)
**Endpoint:** `POST /api/reposts/:postId`
**Response:** `"You cannot repost your own post!"`
**Impact:** Users cannot repost their own content (expected behavior, but should be documented).
**Note:** This is intentional behavior. Testing repost between two users works.

---

## 🟡 Medium Issues

**Closed — Documentation updated.** The API_DOCUMENTATION.md now correctly lists:
- Login: `usernameOrEmail` field
- Signup: `confirmPassword` field
- Auth mechanism: `Authorization: Bearer <jwt_token>` header
- Base URL: port 5006

---

**Closed — Documented behavior, not a bug.**
- In production, every state-changing request requires: `x-csrf-token` header, `Origin` header, and the `csrf-token` cookie
- In development (NODE_ENV !== 'production'), CSRF validation is **bypassed** — no header needed
- This is by design for developer convenience during local development
- API_DOCUMENTATION.md now has a dedicated CSRF section explaining both modes

---

### Issue 8 (Renumbered): Glimpse Create — Requires Multipart with Media
**Endpoint:** `POST /api/glimpses`
**Description:** Returns `"Media is required for a glimpse!"` when no file is attached.
**Impact:** Cannot test with simple curl — needs actual file upload.
**Severity:** Low (expected behavior for media content).

---

### Issue 9: Routes File Discovery — Path Inconsistency
**Description:** Route files exist with consistent naming but some controllers use different import paths.
**Found:** Some route files import controllers from `../controllers/` while others use alternative imports.
**Impact:** Potential confusion during development.

---

## 🟢 Minor Issues / Observations

### Issue 10: Mongoose Warnings
**Observed in server logs:**
- `listeners is a reserved schema pathname` — should add `suppressReservedKeysWarning` option
- `Duplicate schema index on {"inviteCode":1} for model "UserInvite"` — duplicate index definition

### Issue 11: Signup with Existing Email
**Test Result:** Returns appropriate error message: `"User already exists with this email or username!"`
**Status:** ✅ Working correctly — proper duplicate detection.

### Issue 12: Unauthenticated Access
**Test Result:** Returns `"Unauthorized - No token"` for all protected routes.
**Status:** ✅ Working correctly — auth middleware functions properly.

### Issue 13: Login Already Logged In
**Test Result:** If JWT cookie exists and is valid, login returns `"You are already logged in!"`
**Status:** ✅ Working correctly — prevents duplicate login.

---

## 📋 Feature Coverage Summary

| Category | Total Endpoints | Tested | Working | Issues Found |
|----------|----------------|--------|---------|--------------|
| Auth | 4 | 4 | 4 | 0 |
| Password | 4 | 0 | — | — |
| User | 10+ | 5 | 5 | 0 |
| Posts | 15+ | 4 | 4 | 0 |
| Comments | 6 | 2 | 2 | 0 |
| Likes | 1 | 1 | 1 | 0 |
| Follows | 3 | 3 | 3 | 0 |
| Saves | 4 | 2 | 2 | 0 |
| Reposts | 2 | 1 | 1 | 0 |
| Feed | 1 | 1 | 1 | 0 |
| Search | 2 | 2 | 2 | 0 |
| Chat | 11+ | 2 | 2 | 0 |
| Communities | 16+ | 4 | 4 | 0 |
| Glimpses | 7 | 1 | 0 | 1 (media req) |
| Notifications | 9 | 2 | 2 | 0 |
| Collections | 6 | 2 | 2 | 0 |
| Streaks | 6 | 2 | 2 | 0 |
| Daily Missions | 2 | 1 | 1 | 0 |
| XP | 2 | 1 | 1 | 0 |
| Audio Rooms | 5 | 1 | 1 | 0 |
| Block/Mute | 6 | 0 | — | — |
| Close Friends | 4 | 0 | — | — |
| Invites | 4 | 0 | — | — |
| Reports | 3 | 0 | — | — |
| Admin | 6 | 1 | 1 | 0 |
| Archive | 3 | 0 | — | — |
| Link Preview | 1 | 0 | — | — |
| Push | 3 | 0 | — | — |
| Translation | 2 | 0 | — | — |
| **Total** | **~130** | **42** | **41** | **1** |

---

## 🔧 Recommended Fix Priority

### All Critical & Medium Issues Closed ✅

After re-testing all previously reported issues with correct headers and paths:

| Issue | Original Report | Verdict |
|-------|----------------|---------|
| 🔴 Collection Create fails | Internal Server Error | ✅ **Works** with JSON body |
| 🔴 Saves GET `savedByMe` wrong | Always `false` | ✅ **Works** — toggle unsaves on 2nd click |
| 🔴 Daily Missions 404 | Route not found | ✅ **Works** at `/api/missions/today` |
| 🟡 Community multer stripping | JSON body cleared | ✅ **Works** — `upload.single` passes through for non-multipart |
| 🟡 API field naming mismatch | Wrong docs | ✅ **Fixed** — docs updated with correct fields |
| 🟡 CSRF complexity | Undocumented | ✅ **Fixed** — docs updated with CSRF section |

### Remaining Minor Items
- 🟢 **Glimpse Create** — Requires multipart with media file (expected behavior)
- 🟢 **Mongoose warnings** — Reserved `listeners` pathname, duplicate index
- 🟢 Some features untested: Password, Block/Mute, Close Friends, Invites, Reports, Archive, Link Preview, Push, Translation
