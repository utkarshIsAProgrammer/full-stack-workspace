# ORBIT — Manual QA & Change Report

**Generated:** 2026-08-07
**Scope:** Manual browser testing (Chromium via Puppeteer) + API-level edge-case/security tests across the entire app.
**Test users:** `qaprofa651801` / `qaprofb651801` (close friends), `qauserc43783` (non-close-friend), all password `Test1234!`.

---

## 1. Authentication & Accounts

### Tests performed (all manual in browser)
| Feature | Result | Edge cases tested |
| --- | --- | --- |
| Signup | ✅ 11/11 | Empty submit, invalid email, weak password, password mismatch, duplicate username/email, success → auto-login, session persists on reload |
| Login | ✅ 6/6 | Unknown user, wrong password, locked account, valid login |
| Logout | ✅ | 2-step confirm → landing, JWT cookie cleared, caches wiped |
| Session check on load | ✅ | Reload keeps session |
| Forgot / Reset password | ✅ 6/6 | OTP request → wrong OTP rejected ("Invalid OTP!") → weak password rejected → correct OTP resets → login with new password works → original restored |
| Delete Account | ✅ | Wrong email/password rejected; delete → logout → landing; login-after-delete blocked |
| OAuth (Google) | ✅ wired | "Continue with Google" → `/api/auth/google` → redirects to `accounts.google.com` (full sign-in needs real Google account, not testable headless) |

### Bugs found & fixed
1. **Forgot-password flow was completely broken** — `verifyOtpSchema` required `confirmPassword`, but the forgot-password form sends only `{email, otp, newPassword}` → every reset failed with a raw Zod error. **Fix:** made `confirmPassword` optional in `server/src/schemas/user.schema.ts` (still enforced when sent).
2. **UI stuck logged-in after account deletion** — client called `POST /api/auth/logout` after delete, but logout required CSRF + auth (both gone after deletion) → 403/404 → cleanup never ran. **Fix (3 parts):**
   - `server/src/middlewares/csrf.middleware.ts` — added `/api/auth/logout` to `publicPaths`
   - `server/src/routes/auth.routes.ts` — removed `protect` from the logout route (idempotent cookie-clear)
   - `client/src/App.tsx` — `handleLogout` cleanup moved into a `finally` block so it always runs

### Validation
- Auth tests: 13/13 pass (updated the one test asserting the old buggy logout-401 behavior in `server/src/__tests__/auth.test.ts`)
- Full server suite: 71/71 pass, 9 suites
- Server + client typecheck clean

---

## 2. User Profiles

### Tests performed
| Feature | Result | Notes |
| --- | --- | --- |
| View by ID / Username | ✅ | Parallel server queries; header paints first |
| Edit Profile | ✅ | Name, bio, links; validation edge cases |
| Avatar & Banner Upload | ✅ | Cloudinary, cropped & downscaled before upload; portal-centered cropper (no scrolling) |
| Profile Share / Forward | ✅ | Share menu → forward to chat + copy link (toast + in-app & device notification) |
| Followers / Following | ✅ | Lists + follow/unfollow edge cases |
| Follow Requests (Private) | ✅ | Send / approve / decline flow |
| **Pinned Posts** | ✅ (fixed) | Up to 3 pinned to profile top |
| Profile Tabs | ✅ | Posts, Saved, Reposts, Drafts, Collections |
| Profile View Counter | ✅ | Tracks visits |
| XP + Level Display | ✅ | Badge + progress in header |
| Block / Mute on Profile | ✅ | Inline block/unblock toggle |
| Suggestions | ✅ | `GET /api/users/suggestions` — affinity-based |
| Post View Tracking | ✅ | 3s-in-view increments view count app-wide |

### Bugs found & fixed
1. **`pinPost` never actually pinned** — assigned the *old* array without pushing the new `postId` (plus a copy-paste duplicate line). **Fix:** `server/src/controllers/user.controllers.ts`.
2. **Drafts leaked into the public posts list** — `getUserPosts` had no status filter. **Fix:** added `status: "published"` filter (matching every other endpoint).
3. **Pinned-posts UI was entirely missing** — backend endpoints existed but `Profile.tsx` had zero references. **Fix:** implemented pinned section + Pin/Unpin menu options + `displayPosts` computation in `client/src/components/Profile.tsx`.

---

## 3. Posts, Polls, Scheduling & Collaboration

### Tests performed (browser + API)
| Feature | Result | Notes |
| --- | --- | --- |
| Create Post (text) | ✅ | Published in ~2.4s, appears instantly (201) |
| Image Downscale Before Upload | ✅ | `downscaleImageFile` wired in PostModal |
| Edit Post | ✅ | `isEdited: true` tracked; **403 for other users** |
| Delete Post | ✅ | Cascading cleanup; **403 for other users** |
| Hashtags | ✅ | Extracted server-side (max 10, deduped); click → hashtag page |
| Mentions | ✅ | `@` autocomplete via `/api/search/users`; exact mention → notification created (verified in DB + API) |
| Quote Reposts | ✅ (fixed) | Commentary on repost; count on original |
| Repost | ✅ | Toggle with optimistic UI, green icon |
| Audience (Public / Close Friends) | ✅ | Green "🔒 Close Friends" badge; outsiders get **404** on view/like/repost/comment/vote |
| View Count | ✅ | Deduped per-session 3s counter (app-wide hook) |
| Reach Stats | ✅ | Views / likes / shares / saves on card |
| Poll — Create with Post | ✅ | Multiple options, optional expiry |
| Poll — Vote once, locked | ✅ | 400 "You have already voted" on change; race-safe atomic update |
| Poll — Results Display | ✅ | Live counts; white + golden-glow selected style |
| Poll — Expiry | ✅ | 400 "Poll has already expired" blocks late votes |
| Poll — Notification on Vote | ✅ | `poll_vote` notification to author |
| Save Draft | ✅ | Not visible in feed |
| Publish Draft | ✅ | Instant optimistic publish + feed cache prepend |
| Draft Manager | ✅ | View/edit/delete drafts in Profile tab with confirm dialog |
| Schedule Post | ✅ | `scheduledAt` auto-publish via cron — **verified live** (publisher ran, post went `scheduled → published`) |
| Invite Collaborator | ✅ | Backend wired; button disabled in UI (as documented) |
| Accept Collaboration | ✅ | 200 "Collaboration accepted" |
| Collab Badge | ✅ | `✦ with @username` shown on card |

### Bugs found & fixed
1. **Quote Repost was unreachable from the main feed** — the "Quote" button only existed in the filtered feed view (search/notification). **Fix:** added a Quote trigger to the main feed card action row in `client/src/components/Feed.tsx` (with `readOnly` guard + `aria-label` on both render paths).
2. **`pinnedByMe` missing from client `Post` type** — Profile pin UI referenced a field the client type didn't define (3 TS errors). **Fix:** added `pinnedByMe?: boolean` to `client/src/types.ts`.

### Security edge cases verified (API)
- Vote on expired poll → 400
- Unauthenticated vote → 403
- Vote on non-existent post → 404
- Vote on non-poll post → 400
- Invalid option index → 400
- B (not author) edits/deletes A's post → 403
- C (non-close-friend) views/likes/reposts/comments A's close-friends post → 404
- B (close friend) can view + comment on A's close-friends post → 200/201
- Quote-repost does NOT double-count when user already plain-reposted (checks existing Repost first)

---

## 4. Summary of All Code Changes

### Server (`server/src/`)
| File | Change |
| --- | --- |
| `schemas/user.schema.ts` | `confirmPassword` made optional in `verifyOtpSchema` (forgot-password flow) |
| `middlewares/csrf.middleware.ts` | `/api/auth/logout` added to `publicPaths` |
| `routes/auth.routes.ts` | Removed `protect` from logout route (idempotent) |
| `controllers/user.controllers.ts` | Fixed `pinPost` (wasn't pushing postId); added `status: "published"` filter to `getUserPosts` |

### Client (`client/src/`)
| File | Change |
| --- | --- |
| `App.tsx` | `handleLogout` cleanup in `finally` block |
| `components/Profile.tsx` | Added pinned-posts section + Pin/Unpin menu options + displayPosts computation |
| `components/Feed.tsx` | Added Quote repost trigger to main feed cards (was filtered-view only) + aria-label on both |
| `types.ts` | Added `pinnedByMe?: boolean` to `Post` interface |

### Tests updated
| File | Change |
| --- | --- |
| `server/src/__tests__/auth.test.ts` | Updated logout test to assert new idempotent-logout behavior (200) |

---

## 5. Final Validation Results

| Check | Result |
| --- | --- |
| Server typecheck (`npx tsc --noEmit`) | ✅ Clean |
| Client typecheck (`npx tsc --noEmit`) | ✅ Clean |
| Server test suite (`npx jest`) | ✅ 71/71 pass, 9 suites |
| Client test suite (`npx vitest run`) | ✅ 37/37 pass, 9 files |
| Code review (deepseek-flash) | ✅ Approved (minor notes addressed: aria-labels, double-count check) |

---

## 6. Test Artifacts

Browser QA scripts live in `/tmp/orbit-auth-qa/` (auth, profile, posts/polls/quote/CF tests). Screenshots of every test step are saved there as `*.png`.

---

# Feed & Discovery QA (08-07)

Manually tested in Chromium (Puppeteer) + API-level edge-case/security checks, on the running dev servers (API :5006, client :5173) with seeded QA users A/B/C.

## Test Matrix

| Feature | Result | Notes |
| --- | --- | --- |
| Ranked feed (`/api/feed`) | ✅ | Backend exists & wired |
| **For-You feed surfaced in client** | ✅ **NEW** | Added **Home / For You** toggle to the feed header — client previously only ever hit chronological `/api/posts`; the affinity-scored `/api/feed/for-you` endpoint existed server-side but was unreachable from the UI. Toggle verified in browser: clicking **For You** fires `/api/feed/for-you` and renders scored posts; page-based pagination handled (`forYouPage`). |
| Explore | ✅ | Trending + discovery segments render |
| Trending posts/users/hashtags | ✅ | `GET /api/posts/trending/hashtags` reached from client |
| Infinite scroll | ✅ | IntersectionObserver sentinel (viewport-root, 200px margin); verified a 2nd `?cursor=` page fetch fires when scrolled to bottom |
| Pull-to-refresh | ✅ | Real touch events (Puppeteer `touchscreen`) — indicator + `/api/posts` refetch confirmed. (Synthetic `TouchEvent` objects don't reach React — test artifact, not an app bug) |
| Swipe to Like/Repost | ✅ | Gesture offsets + overlay indicators work |
| Realtime post create → feed | ✅ | B created a post via API → **appeared in A's feed without reload** (socket `post:created`) |
| Realtime post delete → removed | ✅ | B deleted it → disappeared without reload (socket `post:deleted`) |
| Saves filter view | ✅ | Saved post (B's) visible in the Saved tab with full **content** (was missing before the fix) |
| Reposts filter view | ✅ | Reposted post visible in Reposts tab with full content |

## Bugs found & fixed

1. **`content` missing from Saves & Reposts list responses** — `getSavedPosts` and `getRepostedPosts` used a `.select()` string that omitted `content` (and `video`), so saved/reposted cards rendered with an empty body. → Added `content`, `images`, `video` to both selects. Verified via API + browser (post text now visible in both tabs).
2. **For-You feed unreachable from the app** — the endpoint existed but no UI surfaced it. → Added the **Home / For You** toggle.
3. **Stale-mode closure in feed fetch** — `handleFeedModeChange` called `fetchPosts(true)` which still saw the *previous* `feedMode`, so the first For-You fetch hit `/api/posts` instead of `/api/feed/for-you`. → Pass an explicit `feedModeOverride`.
4. **Swipe indicators used emojis (❤️/🔄)** — violates the app's no-emoji rule. → Replaced with lucide `Heart` / `Repeat2` icons in both feed maps.
5. **`/api/feed/for-you` not cache-warmed** — added to `TAB_ENDPOINTS.home` in `client/src/utils/api.ts` (eviction already covered via `cachedPath.startsWith("/api/feed")`).

## Security checks (all ✅)

| Check | Result |
| --- | --- |
| Anonymous feed read | ✅ `/posts` is `optionalAuth` (public read-only feed by design) — public posts only, **no close-friends leakage** |
| Close-friends post invisible to non-CF user | ✅ Not in C's feed, `404` on direct view |
| Anonymous sees no CF posts | ✅ |
| Non-CF like/comment on CF post | ✅ `404` both |
| CF author can view own CF post | ✅ `200` |
| Rate limiting | ✅ Global `generalLimiter` (300/15min) + `interactionLimiter` (80/min) on mutations; feed reads intentionally un-throttled beyond the general limiter |

## Validation

| Check | Result |
| --- | --- |
| Server typecheck | ✅ Clean |
| Client typecheck | ✅ Clean |
| Server tests | ✅ 71/71 |
| Client tests | ✅ 37/37 |
| Code review | ✅ Approved — For-You response shape (page-based) matches the client branch; cache eviction confirmed covered |

## Files changed

| File | Change |
| --- | --- |
| `client/src/components/Feed.tsx` | Home/For-You toggle + `feedMode` state + mode-override fix + lucide swipe icons (both maps) |
| `client/src/utils/api.ts` | `/api/feed/for-you` added to home-tab cache warming |
| `server/src/controllers/saves.controllers.ts` | `.select()` now includes `content images video` |
| `server/src/controllers/repost.controllers.ts` | `.select()` now includes `content images video` |

---

# Communities QA (08-07)

Manually tested in Chromium (Puppeteer) + API-level edge-case/security checks against the running dev servers (API :5006, client :5173) with QA users A (qaprofa651801) and B (qaprofb651801).

## Test Matrix

| Feature | Result | Notes |
| --- | --- | --- |
| Create community | ✅ | 201; **BUG FIXED**: `createCommunity` previously dropped `allowAudioCalls`/`allowVideoCalls` (both defaulted false) — now respects them (`typeof === 'boolean'` strict check). Verified `audio: true video: true` on create. |
| Create without name | ✅ | Blocked 400 |
| My Communities / Browse tabs | ✅ | Verified both; leave hides from Mine, stays in Browse |
| Join / Leave | ✅ | 200 both ways; B's Mine hides after leave |
| Member list | ✅ | Count correct |
| Messaging | ✅ | 201 send; **non-member blocked 403** on send AND read |
| Edit message | ✅ | 200; **non-author blocked 403** |
| Reactions | ✅ | Toggle persists; `lastAction` preview works |
| Pinned messages | ✅ | Pin/unpin + pinned list |
| Last-action preview | ✅ | "Name reacted ❤️" style shown (confirmed as `unpin` after unpin = correct) |
| Message search | ✅ | 200 |
| Mute community | ✅ | Long-press menu + toggle true/false |
| Settings toggles | ✅ | Messaging / audio / video all toggle; **non-admin blocked 403** |
| Audio/Video calls | ✅ | LiveKit token endpoint wired |
| Delete community | ✅ | Creator-only 200 |
| Active users | ✅ | Presence via socket (green dots when online) |

## 🔒 Security — all clean
- Non-member cannot read or send messages (403)
- Non-member/non-creator cannot remove members (403 "Only the community creator can remove members!")
- Member non-creator cannot remove members (403)
- Creator can remove members (200)
- Non-admin cannot toggle settings (403)

## 🐛 Bug found & fixed
1. **createCommunity dropped call toggles** — `allowAudioCalls`/`allowVideoCalls` from the create body were ignored, so communities were always created with calls disabled even when the caller passed them. Fixed in `server/src/controllers/community.controllers.ts` with strict boolean mapping. Verified end-to-end after server restart.

## ✅ Validation
- Server: **71/71 tests pass**, typecheck clean
- Client: **37/37 tests pass**
- Code review approved (reviewer's boolean-coercion concern already handled — strict `typeof` check, not `Boolean()`)

---

# Audio & Video Calls QA (08-07)

Manually tested in Chromium (Puppeteer, two browser contexts with fake media devices) + API-level edge-case/security checks against the running dev servers (API :5006, client :5173, LiveKit configured) with QA users A (qaprofa651801) and B (qaprofb651801).

## Test Matrix

| Feature | Result | Notes |
| --- | --- | --- |
| 1-on-1 audio call init | ✅ | From personal chat header → outgoing UI with "Calling..." |
| Incoming call UI (B) | ✅ | Ring state shown, accept/decline buttons render |
| Accept → active | ✅ | Call timer (00:03) runs on both ends — media connected |
| End call | ✅ | Red end button tears down cleanly |
| 1-on-1 video call init | ✅ | Video Call button → getUserMedia + video UI |
| Decline call | ✅ | B declines → A's UI clears, no phantom state |
| Group call (community) | ✅ | Audio call from community → LiveKit token → GroupCallFloor renders |
| Group call join banner | ✅ | B opens community mid-call → "Live group audio call — tap to join" banner; click joins the same room |
| Call state handling | ✅ | outgoing / incoming / active / ended all observed live |
| Call notifications | ✅ | Socket-driven (call:offer/answer/ice/end relayed in realtime) |

## API & Security

| Check | Result | Notes |
| --- | --- | --- |
| Member LiveKit token (audio) | ✅ | 200 + JWT token |
| Member LiveKit token (video) | ✅ | 200 + JWT token |
| Stable room per community | ✅ | roomName = `community-{id}` for all members |
| Non-member token request | ✅ | 403 |
| Calls disabled → token blocked | ✅ | 400 "Audio calls are disabled..." |
| Video still allowed after audio-off | ✅ | 200 |
| Unauthenticated token request | ✅ | 403 (CSRF denies state-changing POST) |
| **Blocked user cannot ring** | ✅ | A blocks B → B's call:offer is DROPPED by `canRelayCall` guard → A never sees an incoming call |
| Call relay requires shared conversation | ✅ | `canRelayCall` verifies a DM conversation exists + not blocked before relaying any call event |

## Summary
- **No app bugs found** — the call stack is in excellent shape. All flows verified end-to-end in the browser with two real sessions.
- 1-on-1 audio: init → ring → accept → active timer → end (8/8 checks)
- 1-on-1 video: init → decline → clean teardown (3/3)
- Group call: start → floor → join banner → join (4/5 in first run; banner + join confirmed in focused run)
- Block isolation: **5/5** including the blocked-user ring suppression

## ✅ Validation
- Server: **71/71 tests pass**, typecheck clean
- Client: **37/37 tests pass**, typecheck clean

## 🐛 Bugs found & fixed during Call QA

1. **`canRelayCall` cache ignored mid-session blocks** (server/src/configs/socket.ts) — the `authorizedCalls` cache short-circuited BEFORE the block check, so if A called B successfully and B blocked A later (same socket session), A could still ring B until reconnect. **Fixed**: the bidirectional `Block.exists` check now runs on every security-critical relay (offer/answer/end/missed/ice-restart) and evicts the cached target on block. The high-frequency `call:ice-candidate` path keeps the cache fast-path (candidates only flow after an offer/answer passed the block check) to avoid a DB round-trip per candidate.
2. **`community:join` + `community:call-status` had no membership check** (server/src/configs/socket.ts) — any authenticated user could subscribe to any community's socket room (receiving messages/call/presence events) and probe call status for any community. **Fixed**: `community:join` verifies the user is an actual member before `socket.join`; `community:call-status` uses the existing `isCommunityMember` helper. Non-members get nothing.
3. **Community group-call join banner flashed off instantly** (client/src/components/Communities.tsx) — the socket effect deps `[socket, selectedCommunity, userId]` re-run on every `selectedCommunity` identity change (member count, presence, toggle events), and its cleanup called `setActiveCommunityCall(null)` every time — wiping the "Join call" banner the moment it appeared, plus re-emitting `community:call-status` per re-run caused toast spam. **Fixed**: `activeCallBannerCommunityRef` + render-updated `selectedCommunityIdRef` so the cleanup only clears the banner when switching to a different community; `callStatusRequestedRef` dedupes the call-status request per community. Verified in browser: banner now stays visible and B joins the call (3/3).

---

# Glances (Stories) QA (08-07)

Manually tested in Chromium (Puppeteer) + API-level edge-case/security checks against the running dev servers (API :5006, client :5173) with QA users A (qaprofa651801) and B (qaprofb651801).

## Test Matrix

| Feature | Result | Notes |
| --- | --- | --- |
| Glance feed row on home | ✅ | Strip renders with add container + author rings (compact on mobile) |
| Viewer opens on ring click | ✅ | Progress bars top-aligned, never clipped |
| Media renders in 9:16 frame | ✅ | Real image loaded (800x1200) displayed at 366x550; broken-media guard skips degenerate images |
| Close button | ✅ | Added aria-label="Close glance" (was untestable/unlabeled) |
| Like (heart reaction) | ✅ | POST /api/glimpses/:id/reactions observed, optimistic + revert |
| Reply → DM thread | ✅ | POST /api/glimpses/:id/reply creates/updates conversation; message shows in chat list |
| Reply notification | ✅ | Author receives `glimpse_reply` notification (verified in /api/notifications) |
| Share menu (More ⋯) | ✅ | Share → people picker modal + Copy link + Send |
| Copy glance link | ✅ | Links to /u/:username, clipboard + toast |
| Forward glance to chat | ✅ | Select conversations → sends glance attachment message |
| Viewers list | ✅ | Author-only "Viewed by" (lazy fetch via GET /api/glimpses/:id) |
| Close-friends privacy | ✅ | CF glimpses hidden from non-CF feed + direct-ID access returns 404 |
| Blocked-user exclusion | ✅ | Blocked users' glimpses excluded from feed |
| Expiry | ✅ | TTL index + controller guard (expired → 404) |
| API latency | ✅ | Feed 0.2–0.7s cold; cache-first stale-while-revalidate for repeat views |

## 🐛 Bugs found & fixed

1. **Expired glimpses still reachable by direct ID / action** (server/src/controllers/glimpse.controllers.ts) — `getGlimpse`, `reactToGlimpse`, `replyToGlimpse`, and `forwardGlimpse` did NOT reject expired glimpses (only `viewGlimpse` did). Between expiry and the TTL sweep, content stayed reachable by URL and could be forwarded/reacted/replied to. **Fixed**: consistent `expiresAt < now → NotFoundError` guard on all four read/action endpoints (`deleteGlimpse` intentionally unguarded for author cleanup). Verified: get/react/reply/forward → 404, feed excludes expired.
2. **Viewer close button had no accessible label** (client/src/components/GlanceViewer.tsx) — plain X icon button with no aria-label/title. **Fixed**: added `aria-label="Close glance"`.

## Validation
- Server: 71/71 tests, typecheck clean
- Client: 37/37 tests, typecheck clean
- QA_REPORT.md updated

---

# Search QA (08-07)

Manually tested in Chromium (Puppeteer, mobile + desktop) + API-level edge-case/security checks against the running dev servers (API :5006, client :5173) with QA users A (qaprofa651801) and B (qaprofb651801).

## Test Matrix

| Feature | Result | Notes |
| --- | --- | --- |
| Search users (username/fullName) | ✅ | Text index + regex fallback; self excluded; pagination cursor |
| Search posts | ✅ | Public-only, author populated, blocked authors excluded |
| Hashtag search | ✅ | `#tag` strips #, matches tags + hashtags arrays |
| Search messages (personal) | ✅ | Participant-only, per-user cache key, debounced |
| Search in chat header | ✅ | Only via three-dot menu → Search messages (no direct icon) |
| Community message search | ✅ | Member-only (403 for non-members), blocked senders excluded |
| Trending users / topics | ✅ | Topics: 7-day window, PUBLIC posts only (CF hashtags never leak), cached 300s, 0.39s |
| Result caching | ✅ | Redis search cache 60s; repeat search 65-69ms |
| Rate limiting | ✅ | searchLimiter on all search/trending routes |
| Anonymous search | ✅ | optionalAuth allows unauthenticated search |
| Debounce (client) | ✅ | 6 keystrokes → 1 API call |

## 🔒 Security verified

1. **Blocked users excluded from search** — blocked user absent from `/search/users` and their posts absent from `/search/posts` (verified by blocking B and re-searching as A).
2. **Community message search is member-only** — `searchCommunityMessages` verifies membership (403 Forbidden for non-members) and excludes blocked senders via per-user cache key.
3. **Personal message search is participant-only** — verifies the caller is a conversation participant; invalid IDs → 400.
4. **Close-friends posts never surface in trending** — trending topics aggregates only `visibility: "public"` posts.
5. **Per-user cache keys** prevent cross-user cache contamination (blocked-filtered results never leak to another user).

## Validation
- Server: 71/71 tests, typecheck clean
- Client: 37/37 tests, typecheck clean
- QA_REPORT.md updated

---

# Search Security Follow-up (08-07)

Two reviewer findings from the Search QA were resolved and verified:

## 1. closeFriends posts leaked via $text search — FIXED

**Bug**: `searchPosts` text-index path (`$text: { $search: q }`) did NOT filter `visibility`, so closeFriends-only posts surfaced in search results for ANY user — including non-close-friends. The regex fallback and no-query paths both filtered `visibility: "public"`, making this an inconsistency that leaked private content.

**Fix** (server/src/controllers/search.controllers.ts): added `visibility: "public"` to the `textQuery` object, matching the fallback path.

**Verified**: created a fresh non-close-friend user via signup, inserted a unique-closeFriends post, searched for its unique keyword — 0 results. Also verified a mutually-blocked user gets 0 results. Cleanup performed.

## 2. Stale search cache after block/unblock — ALREADY HANDLED, verified

**Reviewer concern**: block/unblock doesn't evict the 120s route-level `cacheMiddleware` + 60s controller-level Redis caches, so a blocked user could linger in search for ~2 min.

**Finding**: `clearUserVisibilityCaches` (called in both `blockUser` and `unblockUser`) already evicts:
- `api:${userId}:*` (route-level cacheMiddleware keys — verified key shape `{prefix}:{userId}:{path}:{query}`)
- `search:users:*`, `search:posts:*` (controller-level search caches)
- `trending:*`, `feed:*`, `glimpses:*`, `notifications:*`

**Verified empirically**: A searches for B (cached) → A blocks B → immediate re-search shows B GONE (no TTL wait) → A unblocks → B restored. No code change required.

## Validation
- Server typecheck clean, 71/71 tests pass
- QA_REPORT.md updated

---

# Notifications + Push QA (08-07)

Manually tested in Chromium (Puppeteer mobile 390x844 + desktop 1440x900) and at the API level against the running dev servers (API :5006, client :5173) with QA users A (qaprofa651801) and B (qaprofb651801).

## Sections covered: 11. Notifications, 12. Push Notifications (On-Device)

## Test Matrix

| Feature | Result | Notes |
| --- | --- | --- |
| Notification feed | ✅ | Slim rows; like + comment notifications render |
| Categories (All/Likes/Comments/Follows/Mentions) | ✅ | Icon pills; active tab shows label (tap-to-reveal design) |
| Tab bar fit-to-screen | ✅ | No overflow on mobile (390px) or desktop (1440px) |
| Filter by category | ✅ | Likes filter shows only likes; comment row hidden |
| Unread badge (API) | ✅ | unread-count reflects fresh notifications immediately |
| Mark one / mark all read | ✅ | 200; cache invalidated so badge updates instantly |
| Delete one / clear all | ✅ | 200 with cache invalidation |
| Deep-link routing | ✅ | Click like-notification → opens the post in-app |
| Follow notification | ✅ | Fresh follow creates type=follow notif + unread count +1 (verified with clean isolated test) |
| Like/comment notifications | ✅ | Created in DB; visible in feed; unread-count 2 |
| VAPID endpoint | ✅ | `GET /api/push/vapid-key` returns public key |
| Device subscribe/unsubscribe | ✅ | Both endpoints 200; fake test subs cleaned up |
| Realtime socket push | ✅ | createNotification → socket event + toast + badge |
| Push dispatch for ALL event types | ✅ | like, comment, follow, mention, repost, save, poll_vote, glimpse_reply, collab_invite, follow_request, daily_reward, streak_reminder, profile/post/glimpse/comment share → sendPushToUser; chat + community messages dispatch directly; scheduler (streaks/daily) too |
| Notification text | ✅ | Plain text: "replied to your glance", "Photo", "Voice note" — no emoji |

## Bugs found & fixed

### 1. Service worker never registered in dev — on-device push impossible (FIXED)

**Root cause**: `vite-plugin-pwa` was configured WITHOUT `devOptions.enabled`. `injectRegister: 'auto'` only injects the SW registration into **production builds** (verified: dist/index.html had registerSW, dev HTML had none). So while developing against the dev server, `navigator.serviceWorker.ready` never resolved, `pushManager.subscribe` never ran, and **no device ever subscribed → no on-device notifications**. This is the root cause behind the long-running "real on-device notifications are not showing" reports.

**Fix** (`client/vite.config.ts`): added `devOptions: { enabled: true, type: 'module' }`.

**Verified**: `navigator.serviceWorker.getRegistrations()` → count:1, scope /, state activated, controller:true in dev.

### 2. Dev service worker crashed at evaluation — registration always failed (FIXED)

**Root cause**: In dev, vite-plugin-pwa injects an **empty** precache manifest (`precacheAndRoute([])`). `src/sw.js` eagerly called `createHandlerBoundToURL('/index.html')`, which throws *"that URL is not precached"* during module evaluation → the ENTIRE SW failed to install → push (and offline) dead even after enabling devOptions.

**Fix** (`client/src/sw.js`): the navigation-fallback route is now registered only when the manifest actually contains `index.html`:

```js
const __manifest = self.__WB_MANIFEST || [];
precacheAndRoute(__manifest);
const hasAppShell = __manifest.some((e) => typeof e === 'string' ? e === 'index.html' : e?.url === 'index.html');
if (hasAppShell) { registerRoute(..., createHandlerBoundToURL('/index.html')); }
```

**Verified**: SW activates in dev (script eval succeeds); in production build the guard keeps the fallback (manifest contains index.html) — checked minified dist/sw.js.

### 3. Emoji in push bodies (FIXED)

Chat/community push bodies used emoji + generic text ("📷 Photo", "📎 Attachment"). Per the app's plain-text, type-specific convention, added `attachmentPushLabel()` in `server/src/services/pushService.ts` (Voice note / Photo / Video / GIF / Sticker / Meme / File / New message) and wired it into both `chat.controllers.ts` and `community.controllers.ts` push sends. Attachment type union verified as `voice_note | image | gif | video | file` in both controllers — all covered.

## Environment notes

- Actual OS-level delivery needs a real browser + FCM (HTTPS). In this sandbox, `pushManager.subscribe` cannot complete (no reachable push service), so end-to-end FCM delivery wasn't observable — but every client→server→DB step (SW register, VAPID fetch, subscribe POST) is code-verified and the server dispatch path is fully audited.
- Chrome's Push API is unsupported in incognito — tests use the default context.

## Validation

- Server typecheck clean; client typecheck clean; client production build succeeds with guard intact
- Server tests 71/71, client tests 37/37

---

# Close Friends QA (08-07)

Manually tested in Chromium (Puppeteer mobile 390x844) + API-level privacy/security checks against the running dev servers (API :5006, client :5173) with QA users A (qaprofa651801), B (qaprofb651801) and a fresh non-CF user C.

## Section covered: 13. Close Friends

## Test Matrix

| Feature | Result | Notes |
| --- | --- | --- |
| Add close friend | ✅ | `POST /api/users/close-friends/:id` 200; $addToSet dedupe |
| Self-add blocked | ✅ | 400 "Cannot add yourself" |
| List close friends | ✅ | Populated list, blocked users filtered out |
| Status check | ✅ | `/close-friends/:id/check` true/false correct |
| Remove close friend | ✅ | `DELETE` 200; $pull removes |
| CF-only posts: visible to CF friend | ✅ | Ranked feed includes for B |
| CF-only posts: hidden from non-CF | ✅ | Feed, profile posts, and search all hide (search hard-filters public) |
| CF-only posts: hidden AFTER removal | ✅ | **was leaking via 5-min ranked-feed cache — fixed** |
| CF-only glances: visible to CF | ✅ | /glimpses/feed includes for B (real multipart upload) |
| CF-only glances: hidden from non-CF | ✅ | C's feed excludes; public glance still visible |
| CF-only glances: hidden after removal | ✅ | Immediate |
| Settings → Close Friends UI | ✅ | Search people → Add → appears in list → Remove (8/8 browser tests) |

## Bugs found & fixed

### 1. Removed close friend kept seeing CF posts (server cache leak) — FIXED

`server/src/controllers/closeFriends.controllers.ts` — the ranked feed is cached per-user at `feed:ranked:{userId}` (5-min TTL). Removing someone from close friends only cleared the author's caches + `posts:*`/`api:*:*posts*`, so the **removed friend's own cached ranked feed kept showing the author's closeFriends posts for up to 5 minutes** — a real privacy leak.

**Fix**: new `invalidateViewerFeedCaches(viewerId)` clears `feed:ranked:{viewerId}` + `feed:for-you:{viewerId}:*`; called on both add (so the new friend sees existing CF posts immediately) and remove (privacy). Reviewer confirmed: the ranked feed network section is `followedUserIds + self` and for-you filters CF authors at query time, so only the affected viewer's caches matter; search can't leak (hard `visibility: "public"` filter); profile-post staleness already covered by `clearFeedCache()`.

**Verified**: B's feed re-fetched immediately after removal no longer contains the CF post.

### 2. UI list didn't update after add/remove (client cache) — FIXED

`client/src/components/CloseFriendsTab.tsx` — `apiFetch` is cache-first (2-min default TTL), so the `fetchCloseFriends()` call after adding kept serving the **stale cached empty list** — the added friend never appeared until reload (the "reload to see changes" bug pattern).

**Fix**: `evictCachedResponse("/api/users/close-friends")` before refetching in both `addCloseFriend` and `removeCloseFriend` (matches the Communities.tsx pattern).

**Verified**: 8/8 browser UI tests — search → add → appears in list → remove → gone, with API-level confirmation of each step.

## Validation

- Server typecheck clean; client typecheck clean
- Server tests 71/71, client tests 37/37
- Code review passed (minor optional notes only)

---

# Settings QA (08-07)

Manually tested in Chromium (Puppeteer mobile 390x844 + desktop 1440x900) and at the API level against the running dev servers (API :5006, client :5173) with QA users A (qaprofa651801), B (qaprofb651801) and fresh followers.

## Section covered: 14. Settings

## Test Matrix

| Feature | Result | Notes |
| --- | --- | --- |
| Password tab | ✅ | Current-password verification → update; OTP flow covered in Section 1 |
| Account (delete) | ✅ | Email + password confirmation, irreversible warning |
| Privacy — private account toggle | ✅ (NEW) | Server persisted; follow becomes a request |
| Follow Requests flow | ✅ (FIXED) | `POST /follows/:id` now routes private accounts to FollowRequest + notification |
| Notifications — per-category toggles | ✅ (NEW) | Master push + 10 category switches; suppresses in-app + device push |
| Unknown pref keys rejected | ✅ | Whitelist in updateEmailPreferences |
| Invites tab | ✅ | InvitesTab — generate/copy/share/stats |
| Blocked Users | ✅ | List + unblock from Settings |
| Responsive options | ✅ | Desktop sidebar (8 labels); mobile icon-only single-line row (no overflow, no wrap) |
| Dark-only theme | ✅ | No light theme |

## Bugs fixed this round

1. **`/auth/me` stripped `isPrivate`, `isOnboarded`, `notificationsEnabled`, `isAdmin`** (auth.controllers.ts) — the privacy toggle could never reflect its real state and the admin tab could never render. Added all four fields to login + me responses.
2. **Private accounts could be direct-followed** (follow.controllers.ts) — `POST /api/follows/:userId` ignored `isPrivate`; the request flow only existed on a separate `/follow-request` route the UI never called. Now routes to FollowRequest + follow_request notification when private.
3. **Client follow UX** — App.onToggleFollow now handles `{ isPrivate: true }` (undoes optimistic follow, marks Requested, toasts); Profile/Explore follow buttons show a "Requested" state; Profile reconciles its optimistic follower count.
4. **`user:updated` socket payload missing `isPrivate`** — Settings privacy toggle now syncs to the global user state instantly.
5. **requestedFollows not reset on logout** — cleared in both logout + auth:expired paths.

## Validation

- Server tests 71/71, client tests 37/37, both typechecks clean
- API matrix 14/14 (prefs persist/filter, private-account follow flow)
- Browser matrix 7/7 (Settings nav, Privacy + Notifications tabs, desktop sidebar, zero console errors)


---

# Moderation & Blocking QA (08-07)

API matrix + Chromium browser QA (mobile 390x844) against the running dev stack (API :5006, client :5173). Users: qaprofa651801 (A), qaprofb651801 (B), qasetc287380 (C).

## Section covered: 15. Moderation & Blocking

## API Matrix (30/30 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Block user | ✅ | `POST /blocks/:id` — idempotent, returns blocked:true |
| Mutual block check | ✅ | `iBlocked` + `blockedByThem` both true from either side |
| Blocked list | ✅ | `GET /blocks` returns user + blockedUsers keys |
| Chat enforcement | ✅ | Conversation create + message send blocked (403/404) |
| Like enforcement | ✅ | `POST /likes/post/:id` → 403 while blocked; works after unblock |
| Feed filtering | ✅ | U1 feed hides U2's post after block (cache wiped) |
| Profile hiding | ✅ | `GET /users/username/:u` → 404 for blocked pair |
| Mute / unmute user | ✅ | 30-day mute; unmute restores |
| Unblock | ✅ | Restores like + all access instantly |
| Reports | ✅ | post + user reports 201; invalid contentType → 400 |
| Moderation queue | ✅ | Admin-only (403 for non-admin); re-fetches isAdmin from DB |
| Flag auto-hide | ✅ | 3 unique flags → post `status=archived` |

## Browser QA (12/12 PASS)

| Surface | Result | Notes |
| --- | --- | --- |
| Comment three-dot menu (all comments) | ✅ | NEW — was author-only; now opens for every comment |
| Report entry in comment menu | ✅ | NEW — ReportButton inside dropdown for others' comments |
| Profile user-report button | ✅ | NEW — round flag button next to Share for other profiles |
| Report modal + reasons | ✅ | Opens with reason grid + submit |
| Chat three-dot block menu | ✅ | Block option present in header menu |
| Conversation list + open | ✅ | Seeded conversation visible + opens |

## Fixes shipped this round
- `CommentNode.tsx` — menu now available for all comments; author gets Edit/Delete, others get Report; long-press also opens it.
- `Profile.tsx` — `ReportButton` (contentType=user) added for non-self profiles in header actions.
- No server changes needed (enforcement was already correct).


---

# Admin Dashboard QA (08-07)

API matrix + Chromium browser QA (mobile 390x844) against the running dev stack (API :5006, client :5173). User: qaprofa651801 (admin), qaprofb651801 (reporter).

## Section covered: 16. Admin Dashboard

## API Matrix (22/22 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Admin stats endpoint | ✅ | NEW — `GET /api/admin/stats` (users/posts/comments/glances/communities/reports/moderation/online/muted/banned) |
| Admin-gating | ✅ | 403 for non-admin on stats, flags, mute, ban, reports queue |
| User search for moderation | ✅ | `GET /api/search/users?q=` works from dashboard |
| Toggle user mute | ✅ | `PUT /api/admin/users/:id/mute` — persists, invalidates auth cache |
| Toggle user ban | ✅ | `PUT /api/admin/users/:id/ban` — persists + disconnects sockets |
| Feature flags CRUD | ✅ | create/get/update; 201/200; duplicate key → 400 |
| Reports review | ✅ | `PUT /api/reports/:id/review` with valid enum (action_taken/dismissed) |
| Reports queue gating | ✅ | Admin-only; pending-only filter |
| Moderation queue | ✅ | Admin-only |

## Browser QA (9/9 PASS)

| Surface | Result | Notes |
| --- | --- | --- |
| Nav entry (Shield) | ✅ | LeftSidebar shows Admin only for isAdmin users |
| Stats tab (default) | ✅ | Platform Overview + 10 metric cards render |
| Stats data | ✅ | REAL values from DB counts (Online Now = live socket count) |
| Reports tab | ✅ | Seeded pending report listed with reporter + reason |
| Approve report | ✅ | Status flips to action_taken, row removed |
| Users tab search | ✅ | Debounced search returns QA users |
| Ban action | ✅ | Clickable, mutates state optimistically |
| Flags tab | ✅ | Seeded flag shown with rollout % |
| Flag toggle | ✅ | Enabled ↔ Disabled round-trips |

## Bugs found & fixed
1. **AdminDashboard Approve button was broken (500)** — it sent `status: "resolved"` / `action: "warning_sent"` which failed Mongoose enum validation. **Fix:** `AdminDashboard.tsx` sends valid enums (`action_taken` / `dismissed` + `warning`/`none`); `report.controllers.ts` now validates status/action against the model enums (defense-in-depth).
2. **Users tab was inert** — search box did nothing. **Fix:** wired debounced `/api/search/users` + Mute/Ban buttons to the admin endpoints.
3. **Stats tab didn't exist** despite the spec claiming System Stats. **Fix:** added `getAdminStats` endpoint + 10-card Stats tab.
4. **`activeUsers` metric was meaningless** — it used `updatedAt` within 24h which is bumped by logins/profile edits, so it always equalled totalUsers. **Fix:** now uses `getOnlineUsersCount()` from live socket presence (labeled "Online Now").

## Test-harness gotchas (not app bugs)
- Admin promotion via direct DB write left the Redis `auth:user:` cache holding `isAdmin:false` for up to 5 min → all admin endpoints 403'd until the key was deleted. The QA harness now invalidates the Redis key after DB promotion.


---

# Chat / Direct Messages QA (08-07)

Chromium browser QA (desktop 1280x800) + API against the running dev stack. Users: qaprofa651801 (A), qaprofb651801 (B).

## Section covered: 5-6. Chat / Direct Messages

## Browser QA (11/11 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Message seeding (API, multipart) | ✅ | `POST .../messages` with FormData `text` → 201 |
| Conversation list shows partner | ✅ | Chat tab lists QA PROF B |
| Last-message preview | ✅ | "hi from B <id>" shown in list row |
| Conversation opens | ✅ | Input `textarea[placeholder="Type a message..."]` appears |
| Send from UI (Enter) | ✅ | Message appears optimistically + persists |
| Realtime inbound message | ✅ | B's API message arrives live via socket |
| Three-dot menu (header) | ✅ | Search messages / Mute / Clear chat all present |
| Pin message | ✅ | Banner appears with sender + text; pin API 200 |
| Message search | ✅ | Typing query filters to matching message |
| Presence indicator | ✅ | Online/Offline state shown for partner |
| Conversation list perf | ✅ | API round-trip 8ms (was 716ms in first run) |

## Test-harness gotchas (not app bugs)
- **Message route is multipart-only** (`uploadChatMedia.array("files", 5)`) — seeding with JSON silently dropped `text`; the harness must send FormData.
- **Leftover moderation-test state** — user B was still `isBanned:true` in the Redis `auth:user:` cache from the S15 ban test, so B's sends 403'd with "account banned" until the key was cleared. Harness now un-bans + clears Redis keys before each run.


---

# Gamification QA (08-07)

API matrix + Chromium browser QA (mobile 390x844) against the running dev stack (API :5006, client :5173). Users: qaprofa651801 (A), qaprofb651801 (B).

## Section covered: 17. Gamification

## API Matrix (19/19 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| XP baseline | ✅ | totalXP = 0 before actions |
| XP on create post (+10) | ✅ | 0 → 10 |
| XP on comment (+3) | ✅ | 201 |
| XP on receive-like (+2) | ✅ | Post author awarded when someone else likes |
| XP on follow (+2) | ✅ | Only on the actual follow branch (not unfollow/private-request) |
| XP on save (+1) | ✅ | SAVE_POST reward now wired into saves controller |
| Streaks fetch | ✅ | currentStreak returned |
| Claim daily reward | ✅ | 200, streak=1; double-claim → 400 |
| Missions today (6) | ✅ | 6 mission types initialized |
| Like mission progression | ✅ | 5 likes on 5 posts → 5/5 completed |
| Mission claim XP matches message | ✅ | Claimed exactly 15 XP (the per-mission xpReward, not flat 25) |
| Mission double-claim | ✅ | 400 blocked |
| Leaderboard weekly/monthly/alltime | ✅ | topPosts + topCreators arrays |
| Leaderboard invalid type | ✅ | Falls back to weekly |
| XP for other user | ✅ | 200 |

## Browser QA (7/7 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Missions panel on feed | ✅ | Daily Missions + progress rows (Like 5 posts, Comment on 3, etc.) |
| Leaderboard card in Explore | ✅ | New Leaderboard component mounted in trending segment |
| Streaks section in Profile | ✅ | Calendar/streak UI renders |
| XP / level display in Profile | ✅ | Reputation badge shows |

## Fixes shipped
- **ReputationDisplay emoji badges → lucide icons** (user asked to remove emojis from UI).
- **Wired dead XP rewards**: SAVE_POST (saves controller), FOLLOW (follow controller), RECEIVE_LIKE (like controller) were defined in XP_REWARDS but never awarded.
- **Mission claim XP mismatch**: message said "Claimed X XP!" but always awarded flat 25 (COMPLETE_MISSION). Now awards the mission's actual xpReward (15/20/25/etc.) via `awardXP(..., amount)`.
- **Leaderboard had no frontend**: created Leaderboard.tsx and mounted it in Explore.
- **MissionsPanel auto-refresh**: now uses useCacheRefresh so progress made elsewhere reflects without remount.
- **awardXP signature**: added optional `amount` override.

## Test-harness gotchas (not app bugs)
- **Like endpoint is a toggle** — liking the same post 5× cancels out (3 net). Mission tests must like 5 distinct posts.
- **DailyReward/UserStreak state persisted between runs** — reset script now clears them so claim starts fresh.

---

# Translation & Link Previews QA (08-07)

API matrix + Chromium browser QA (mobile 390x844). Users: qaprofa651801.

## Section covered: 18. Translation & Link Previews

## API Matrix (12/12 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Translate EN→ES | ✅ | "Hello world…" → "Hola mundo, esto es una prueba." |
| Translate FR→EN | ✅ | "Bonjour tout le monde" → "Hello everyone" |
| Detect language | ✅ | Spanish text → `es` |
| Translate empty text | ✅ | 400 |
| Translate unauthenticated | ✅ | 403 |
| Link preview (YouTube) | ✅ | Title extracted |
| Link preview (GitHub) | ✅ | Title + description extracted |
| SSRF block 169.254.169.254 | ✅ | Preview null, no leak |
| SSRF block 127.0.0.1 | ✅ | Preview null |
| SSRF block 192.168.x | ✅ | Preview null |
| Invalid URL | ✅ | 400 |
| Link preview unauthenticated | ✅ | 401 |

## Browser QA (11/11 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Spanish post visible in feed | ✅ | Seeded via API |
| Translate buttons render | ✅ | 10 on the feed |
| Translate toggle | ✅ | → translated text + "Show original" |
| Link preview card (GitHub) | ✅ | Title + description + favicon |
| Comments drawer opens | ✅ | |
| French comment visible | ✅ | |
| Comment translate button | ✅ | |
| Comment link preview (MDN) | ✅ | Compact card |

## Fixes shipped
- **Frontend was entirely missing** for both features (only backend existed). Added:
  - `client/src/utils/links.ts` — extractFirstUrl + cached translateText client util.
  - `client/src/components/LinkPreviewCard.tsx` — rich OG card with module-level dedupe + loading shimmer.
  - `client/src/components/TranslateInline.tsx` — Translate/Show-original toggle with detected-language label.
  - Wired into **Feed.tsx** (both card + detail content blocks) and **CommentNode.tsx** (comment content).
- **Path fix**: client called `/api/translations` but the server mounts at `/api/translate`.

---

# Invite System QA (08-07)

API matrix + Chromium browser QA (mobile 390x844). Users: qaprofa651801 (A), qaprofb651801 (B).

## Section covered: 19. Invite System

## API Matrix (10/10 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Generate invite code | ✅ | 201, 8-char hex uppercase |
| Generate idempotent | ✅ | Existing pending code returned (no duplicates) |
| My invites list | ✅ | Populated with invitedUser |
| Invite stats | ✅ | totalInvites + acceptedInvites |
| Self-redeem blocked | ✅ | 400 "cannot use your own code" |
| Invalid code | ✅ | 404 |
| Redeem valid code | ✅ | 200, status → accepted |
| Re-redeem blocked | ✅ | 404 after accepted |
| Stats reflect acceptance | ✅ | acceptedInvites increments |
| Unauthenticated | ✅ | 401 |

## Browser QA (10/10 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Invites tab opens (Settings) | ✅ | Invite Friends card |
| Invite code displayed | ✅ | Monospace code box |
| Copy Link button | ✅ | |
| Share button | ✅ | navigator.share / copy fallback |
| Redeem section | ✅ | NEW — input + Redeem button |
| Invalid redeem error | ✅ | "Invalid or expired invite code!" shown |
| Invite stats | ✅ | Total Sent / Accepted |
| Deep link opens Invites tab | ✅ | /invite/<code> → settings → invites |
| Deep link auto-redeems | ✅ | Code prefilled + redeemed on arrival |

## Fixes shipped
- **Redeem UI was missing entirely** (backend existed, no frontend). Added redeem input + button + inline success/error message to InvitesTab.
- **Deep-link routing for /invite/<code>**: App now navigates to Settings and dispatches `orbit:redeem-invite`; InvitesTab pre-fills + auto-redeems. Uses BOTH a window event (already-mounted) and sessionStorage (cold load where the lazy tab mounts after the deep-link fires).

---

# Offline & Performance QA (08-07)

Chromium browser QA (mobile 390x844) + code audit against the running dev stack.

## Section covered: 20. Offline & Performance

## Browser QA (offline-SPA 6/6 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Feed loads online | ✅ | |
| IndexedDB offline store exists | ✅ | `OrbitDB` + workbox-expiration |
| Feed renders offline (cached) | ✅ | Cached posts render without network |
| Tab navigation works offline | ✅ | Explore + back to Home |
| Recovers when back online | ✅ | Sync engine reconnects |

## Code-audit verification

| Area | Status | Evidence |
| --- | --- | --- |
| Service worker (custom, injectManifest) | ✅ | `src/sw.js` — precache + app-shell fallback + runtime API/chat/image/font caches; devOptions.enabled for dev push |
| Offline DB (Dexie) | ✅ | `offlineDB.ts` — conversations, messages, community msgs, posts, notifications, users tables |
| Sync queue | ✅ | `syncQueue.ts` — queued mutations flush on `online` event; processor pauses when offline |
| Cache-first API layer | ✅ | `apiCache.ts` — TTL, eviction, warm-up, refresh timer, prepend-on-publish |
| Cache eviction on mutation | ✅ | evictCachedResponse used on join/leave/like/publish/comment flows |
| Image optimization | ✅ | `imageUrls.ts` → `w_<width>,q_auto,f_auto`; used in UserAvatar, ImageCarousel, GlancesFeed, GlanceViewer, Profile, Chat, Communities, CommunityProfileOverlay; GIF-safe + already-transformed URLs skipped |
| Downscale before upload | ✅ | `imageCompression.ts` used in posts/glances/chats/avatars |
| Debounced search | ✅ | 300ms debounce + stale-response guard in chat/user search |
| Preconnect CDN | ✅ | index.html preconnects Cloudinary + fonts |
| Code splitting | ✅ | manualChunks + React.lazy on heavy components |
| View dedup | ✅ | usePostViewTracking — one count per post per session |

## Note (not a bug)
- **Offline full-page reload works in production builds** (precached `index.html` + hashed chunks). In the Vite **dev server** it cannot: dev serves unbundled ESM modules that can't be precached. Verified the realistic PWA path instead — load once, browse every tab offline from IndexedDB/caches (6/6).

---

# UI/UX Polish QA (08-07)

Chromium browser QA (mobile 390x844). User: qaprofa651801.

## Section covered: 21. UI / UX Polish

## Browser QA (9/9 PASS)

| Feature | Result | Notes |
| --- | --- | --- |
| Feed content appears | ✅ | Post visible after login |
| Layout stable — no wild shift | ✅ | Height 844 → 844 (Δ0) — blink eliminated |
| Fonts loaded | ✅ | Playfair Display + Inter |
| Dark theme + glass surfaces | ✅ | 22 glass surfaces detected |
| No emojis in UI chrome | ✅ | 0 emoji chars in app chrome |
| Image fade-in applied | ✅ | 11/11 images fade in |
| Tab switch round-trip stable | ✅ | Home → Explore → Home stable |
| Console errors (except expected pre-login 401) | ✅ | 0 real errors |

## Fixes made (blink + polish)

1. **Feed blink eliminated** — background cache refresh (`fetchPosts(true)`) and the mount-time refresh no longer flip the whole feed to skeleton screens when cached content is already visible. Only manual/pull-to-refresh shows skeletons.
2. **Premium CSS polish block** (`index.css`): image load fade-in (kills pop-in), gold focus rings on all interactive elements, gold text selection, tap-highlight removal, smooth scrolling, custom scrollbar styling — all wrapped in `prefers-reduced-motion` guards.
3. **`decoding="async"`** added to feed images + ImageCarousel → less main-thread jank.
4. **Empty-string `src` warnings eliminated** — guarded the composer video preview (`postVideoPreview`), and cleaned DB data: 34 users with `profilePic.url: ""`, 104 posts with `image.url: ""`/`video.url: ""` → normalized to `null` (the exact fix Chrome's warning recommends). Verified with a property-setter patch: 0 empty-src assignments in a full login + home + explore flow.
5. Verified all 16 listed polish features present: glass theme, font pairing, Sonner toasts, three-dot menus, emoji-free UI, WhatsApp-style inputs, keyboard shortcuts, long-press menus, skeleton shimmers, empty states, cropping modals, pinch zoom, responsive settings, swipe-back, dynamic titles, error boundary.

## Validation

Client typecheck clean ✅ · server healthy ✅


---

# Full Feature Audit + Completion QA (08-08)

Created **FEATURE_AUDIT.md** (root) — a living audit covering all 21 feature sections, plus:
- Section 2: problems found (half-built / dead / stale features)
- Section 3: dependency map (no feature blocked by a missing backend dependency)
- Section 4: coverage vs Instagram/X/Facebook comparison table
- Section 6-7: shipped fixes + tracked follow-ups

## Fixes shipped this pass

1. **Collaboration enabled** (was: toggle disabled "coming soon", panel behind `{false && ...}`). Backend was already 100% wired (invite/accept routes, collab_invite notification, ✦ badge + Accept button in feed). PostModal now opens the invite panel, feeds @username into create-post, shows active toggle + collaborator name tooltip. Browser-verified.
2. **Collections UI** (was: full backend, zero frontend). New Profile → Collections tab (self only): create inline, card grid with post counts, open → post list with Remove, delete collection, skeleton/empty states. Feed ShareMenu → "Save to collection" picker (choose existing or create-new-and-add). Cache eviction on all mutations. Browser-verified: tab opens, empty state, create → card appears, zero page errors.
3. **Landing "Coming Soon" card fixed** — Communities (already shipped) replaced with a "Post Reactions" teaser.
4. **Review fixes**: ShareMenu measures actual rendered height (was hardcoded 92px — mis-flipped/clamped with 3 items); stale collection caches evicted after mutations; picker refreshes list in place; collab toggle active-state reflects set username.

## Validation

Client typecheck clean · Feed/Chat vitest 13/13 · Jest 9 suites / 71 tests · server healthy · browser QA zero page errors.

## Follow-ups tracked (FEATURE_AUDIT.md §7)

Collection detail pagination (nextCursor), collab inline validation, delete-collection confirm dialog, post emoji reactions, story highlights, verified badges, custom status, marketplace.


---

# Link Preview Coverage QA (08-08)

## Audit result — before

Link previews existed only on **posts** (Feed) and **comments** (CommentNode). Places users can add links WITHOUT previews:
- Chat messages (personal + community — both render via MessageBubble)
- Profile bio
- Community description
- Post composer (no live preview while typing)

## Fixes shipped

1. **MessageBubble.tsx** — rich link preview below any message containing a URL (compact card). Covers BOTH personal chat (Chat.tsx) and community chat (Communities.tsx) since both render through MessageBubble. Suppressed for in-flight/failed (optimistic) messages via the existing `unsent` guard.
2. **Profile.tsx** — preview below the bio when it contains a URL (compact); bio now wraps properly (`whitespace-pre-wrap break-words`).
3. **CommunityProfileOverlay.tsx** — new "About" block at the top of the overlay with the full description + compact preview when it contains a URL. Removed the redundant truncated description from the tiny header meta line (was duplicated).
4. **PostModal.tsx** — live link preview while composing, **debounced 600ms** so a half-typed `https://g` doesn't fire a request per keystroke (LinkPreviewCard caches by exact URL, so each new char would otherwise bypass the cache and hit the API).

## Verification

- **API**: `GET /api/link-preview?url=https://github.com/facebook/react` returns full OG metadata (title, description, image) — 200.
- **Component test** (new): `MessageBubbleLinkPreview.test.tsx` mocks apiFetch and asserts a `<a target=_blank>` preview card renders for a URL message and is absent for plain text — 2/2 pass.
- **Browser**: preview API requests fire from the composer (typing a URL) and from chat messages; feed/comment previews already confirmed in prior passes.
- Typecheck clean · vitest 10 files / 39 tests · jest 9 suites / 71 tests.
- Chat media (image/video/voice-note attachments) already render via MessageBubble attachment handling — verified intact.

---

# 12 Glances from 12 Users (08-08)

New reusable seed: **`server/scripts/seed-glances.ts`** (`npx tsx scripts/seed-glances.ts`).

- Creates 12 demo users (`glance_arav`, `glance_meera`, … `glance_rohan`) with Unsplash profile pictures + banner.
- Creates **1 public 9:16 portrait glance per user** (staggered timestamps, 24h expiry so they persist).
- Idempotent: skips users/glances that already exist.

Verified:
- Feed API returns exactly **12 glances from 12 glance_ users** (all public, all with media) — HTTP 200.
- Browser QA (mobile 390×844): 12 glance circles render in the home feed strip, Add-a-glance button present, tapping the first glance opens the viewer with the media image + Like/Reply buttons — zero page errors.

---

# Invite Tab: Share/Copy Link removed, copy icon on code (08-08)

- Removed the **Share** button and the **Copy Link** button from the Invite Friends tab.
- Added a **copy icon on the invite code itself** (both the code row and a "Copy" pill in the card header are clickable).
- Copy now copies **just the invite code** (was the full /invite/<code> URL) so recipients paste it into the "Have an invite code?" field.
- Added the standard hidden-textarea fallback for browsers without the async clipboard API.
- Updated helper text to "Share your invite code…".
- Verified in browser: Share/Copy Link buttons absent, copy icon present, clipboard === displayed code (`DB8801D6`), zero page errors. Typecheck clean.
