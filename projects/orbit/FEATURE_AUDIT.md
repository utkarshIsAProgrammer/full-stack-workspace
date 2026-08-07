# ORBIT — Full Feature Audit

**Date:** 2026-08-08
**Method:** Code-level inventory (routes, controllers, models, components) + real-user browser walkthroughs (Chromium, mobile 390×844) + API matrix tests.

This document answers four questions:
1. Which features exist, and was anything **skipped**?
2. Which features are **incomplete / not fully usable**?
3. Which features **depend on missing pieces** (backend-only, frontend-only, dead code)?
4. Does the app have **enough options** compared with other social platforms?

---

## 1. Feature Inventory (every feature, every layer)

### 1. Authentication & Accounts
| Feature | Status | Notes |
| --- | --- | --- |
| Email/Password Signup | ✅ Full | Zod validated, bcrypt |
| Login | ✅ Full | JWT httpOnly cookie |
| OAuth (Google) | ✅ Full | |
| Logout | ✅ Full | Cache wipe + socket stop |
| Session check | ✅ Full | `/api/auth/me` |
| Forgot/Reset password | ✅ Full | OTP → verify → reset |
| Delete account | ✅ Full | Cascading cleanup |
| Auth expiry handling | ✅ Full | `auth:expired` event |

### 2. User Profiles
| Feature | Status | Notes |
| --- | --- | --- |
| View by ID/username | ✅ Full | |
| Edit profile | ✅ Full | Name, bio (ABOUT), links, avatar, banner |
| Avatar/banner crop | ✅ Full | Portal-centered cropper |
| Profile share/forward | ✅ Full | Forward + copy link + notifications |
| Followers/Following | ✅ Full | |
| Follow requests (private) | ✅ Full | |
| Pinned posts | ✅ Full | Up to 3 |
| Profile tabs | ✅ Full | Posts, Saved, Reposts, Drafts |
| XP/level | ✅ Full | |
| Block/mute | ✅ Full | |
| Suggestions | ✅ Full | Affinity based |
| Post view tracking | ✅ Full | 3s-in-view dedup |

### 3. Posts
| Feature | Status | Notes |
| --- | --- | --- |
| Create post | ✅ Full | Text, ≤5 images, 1 video |
| Image downscale | ✅ Full | Client-side, fast publish |
| Edit post | ✅ Full | `isEdited` tracked |
| Delete post | ✅ Full | Cascading + Cloudinary cleanup |
| Hashtags | ✅ Full | |
| Mentions | ✅ Full | Autocomplete + notification |
| Quote repost | ✅ Full | |
| Repost | ✅ Full | |
| Audience (public/CF) | ✅ Full | Green indicator |
| View count | ✅ Full | |
| Reach stats | ✅ Full | |
| **Collaboration** | ⚠️ **Half** | **Backend fully wired; frontend toggle DISABLED ("coming soon")** |
| Polls | ✅ Full | One-vote lock, expiry, golden selection |
| Drafts | ✅ Full | |
| Scheduled posts | ✅ Full | Cron publish |
| **Collections** | ⚠️ **Backend-only** | **Full API exists; NO frontend UI anywhere** |
| **Archive** | ⚠️ **Backend-only** | Routes exist; no UI |
| **Audio rooms** | ❌ **Dead code** | Controller/model/routes exist; not mounted; no UI |

### 4. Feed & Discovery
| Feature | Status | Notes |
| --- | --- | --- |
| Ranked feed | ✅ Full | |
| For-You feed | ✅ Full | |
| Explore | ✅ Full | Trending + discovery |
| Trending | ✅ Full | 7-day window |
| Infinite scroll | ✅ Full | |
| Pull-to-refresh | ✅ Full | |
| Swipe like/repost | ✅ Full | |
| Realtime post events | ✅ Full | |
| Feed cache | ✅ Full | |

### 5. Comments
| Feature | Status | Notes |
| --- | --- | --- |
| Comment CRUD | ✅ Full | |
| Replies | ✅ Full | |
| Emoji reactions | ✅ Full | Toggle system + picker |
| Edit/delete | ✅ Full | |
| Load-more pagination | ✅ Full | |
| Prefetch | ✅ Full | |

### 6. Chat / DM
| Feature | Status | Notes |
| --- | --- | --- |
| Conversation list | ✅ Full | |
| Last-action preview | ✅ Full | |
| Send text | ✅ Full | Optimistic |
| WhatsApp auto-grow input | ✅ Full | |
| Voice notes | ✅ Full | |
| Images | ✅ Full | Downscaled |
| Camera capture | ✅ Full | |
| GIF picker | ✅ Full | Tenor |
| File attachments | ✅ Full | |
| Reply | ✅ Full | |
| Edit (5-min) | ✅ Full | |
| Delete/delete-for-me | ✅ Full | |
| Undo send | ✅ Full | |
| Forward | ✅ Full | |
| Emoji reactions | ✅ Full | |
| Long-press menu | ✅ Full | |
| Three-dot menu | ✅ Full | Search, mute, clear, block |
| Mute conversation | ✅ Full | |
| Pinned messages | ✅ Full | |
| Message search | ✅ Full | |
| Typing indicator | ✅ Full | |
| Presence | ✅ Full | |
| Active users panel | ✅ Full | |
| User search | ✅ Full | Debounced |
| Unread badges | ✅ Full | |

### 7. Communities
| Feature | Status | Notes |
| --- | --- | --- |
| Create/edit/delete | ✅ Full | |
| My/Browse tabs | ✅ Full | |
| Join/leave | ✅ Full | |
| Long-press menu | ✅ Full | Mute/leave |
| Member list | ✅ Full | |
| Active users | ✅ Full | |
| Messaging | ✅ Full | |
| Voice notes | ✅ Full | |
| Reactions | ✅ Full | |
| Pinned messages | ✅ Full | |
| Search | ✅ Full | |
| Last-action preview | ✅ Full | |
| Settings | ✅ Full | |
| Audio/video calls | ✅ Full | |
| Call toggles | ✅ Full | |

### 8. Calls
| Feature | Status | Notes |
| --- | --- | --- |
| 1-on-1 audio | ✅ Full | LiveKit |
| 1-on-1 video | ✅ Full | |
| Group calls | ✅ Full | |
| Incoming call UI | ✅ Full | |
| Call state handling | ✅ Full | |
| Call notifications | ✅ Full | |

### 9. Glances (Stories)
| Feature | Status | Notes |
| --- | --- | --- |
| Glance row | ✅ Full | |
| Add glance | ✅ Full | Loading spinner |
| 9:16 frame | ✅ Full | Centered + zoom/drag |
| Text on glance | ✅ Full | Editable |
| Drawing | ✅ Full | |
| Zoom/reposition | ✅ Full | |
| Audience (public/CF) | ✅ Full | |
| Viewer | ✅ Full | Never clipped |
| Like/reply | ✅ Full | Reply opens DM |
| Share | ✅ Full | |
| Reactions | ✅ Full | |
| Viewers list | ✅ Full | |
| Expiry (24h) | ✅ Full | |
| Reply notifications | ✅ Full | |

### 10. Search
| Feature | Status | Notes |
| --- | --- | --- |
| Search users | ✅ Full | |
| Search posts | ✅ Full | |
| Search messages | ✅ Full | |
| Search in chat header | ✅ Full | Via three-dot |
| Trending hashtags | ✅ Full | |
| Result caching | ✅ Full | |

### 11. Notifications
| Feature | Status | Notes |
| --- | --- | --- |
| Feed | ✅ Full | |
| Categories | ✅ Full | Text-first, icons on overflow |
| Badges | ✅ Full | |
| Mark read/all | ✅ Full | |
| Clear all | ✅ Full | |
| Deep-link routing | ✅ Full | |
| Realtime push | ✅ Full | |
| Types | ✅ Full | 11 types incl. collab |

### 12. Push Notifications
| Feature | Status | Notes |
| --- | --- | --- |
| VAPID key | ✅ Full | |
| Device subscription | ✅ Full | |
| Service worker | ✅ Full | |
| Permission flow | ✅ Full | |
| All major events | ✅ Full | |

### 13. Close Friends
| Feature | Status | Notes |
| --- | --- | --- |
| Add/remove | ✅ Full | Settings only |
| List | ✅ Full | |
| CF posts | ✅ Full | |
| CF glances | ✅ Full | |
| Status checks | ✅ Full | |

### 14. Settings
| Feature | Status | Notes |
| --- | --- | --- |
| Profile edit | ✅ Full | |
| Password | ✅ Full | |
| Account | ✅ Full | |
| Notifications | ✅ Full | |
| Privacy | ✅ Full | |
| Invites | ✅ Full | |
| Blocked users | ✅ Full | |
| Responsive options | ✅ Full | |
| Dark-only theme | ✅ Full | |

### 15. Moderation & Blocking
| Feature | Status | Notes |
| --- | --- | --- |
| Block | ✅ Full | Mutual |
| Blocked feed filtering | ✅ Full | |
| Blocked chat enforcement | ✅ Full | |
| Blocked notification filtering | ✅ Full | |
| Unblock management | ✅ Full | |
| Mute user | ✅ Full | |
| Report content | ✅ Full | |
| Moderation queue | ✅ Full | |

### 16. Admin
| Feature | Status | Notes |
| --- | --- | --- |
| Reports queue | ✅ Full | |
| User moderation | ✅ Full | |
| Feature flags | ✅ Full | |
| System stats | ✅ Full | |

### 17. Gamification
| Feature | Status | Notes |
| --- | --- | --- |
| XP | ✅ Full | |
| Streaks | ✅ Full | |
| Daily missions | ✅ Full | |
| Leaderboard | ✅ Full | |
| Reputation | ✅ Full | |

### 18. Translation & Link Previews
| Feature | Status | Notes |
| --- | --- | --- |
| Translate | ✅ Full | |
| Detect language | ✅ Full | |
| Link previews | ✅ Full | |

### 19. Invites
| Feature | Status | Notes |
| --- | --- | --- |
| Generate | ✅ Full | |
| Stats | ✅ Full | |
| Redeem | ✅ Full | |
| Deep-link `/invite/:code` | ✅ Full | |

### 20. Offline & Performance
| Feature | Status | Notes |
| --- | --- | --- |
| Offline viewing | ✅ Full | Dexie |
| Sync queue | ✅ Full | |
| Cache-first API | ✅ Full | |
| Cache warming | ✅ Full | |
| Cache refresh timer | ✅ Full | |
| Cache eviction | ✅ Full | |
| Instant publish | ✅ Full | |
| Image optimization | ✅ Full | |
| Downscale before upload | ✅ Full | |
| Debounced search | ✅ Full | |
| Preconnect | ✅ Full | |
| Code splitting | ✅ Full | |
| View dedup | ✅ Full | |

### 21. UI/UX
| Feature | Status | Notes |
| --- | --- | --- |
| Glass theme | ✅ Full | |
| Font pairing | ✅ Full | |
| Sonner toasts | ✅ Full | |
| Three-dot menus | ✅ Full | |
| Emoji-free UI | ✅ Full | |
| WhatsApp inputs | ✅ Full | |
| Keyboard shortcuts | ✅ Full | |
| Long-press menus | ✅ Full | |
| Skeletons | ✅ Full | |
| Empty states | ✅ Full | |
| Cropping | ✅ Full | |
| Pinch zoom | ✅ Full | |
| Responsive settings | ✅ Full | |
| Swipe-back | ✅ Full | |
| Dynamic titles | ✅ Full | |
| Error boundary | ✅ Full | |

---

## 2. Problems Found (incomplete / skipped / dead)

### 🔴 P1 — Collaboration is backend-complete but frontend-disabled
- **Backend:** `POST /api/posts/:postId/collab-invite` + `collab-accept` fully implemented; create-post resolves collaborator by @username, sends `collab_invite` notification; model has `collaborator` + `collabAccepted`; feed shows "✦ with @user" badge + **Accept collaboration** button; notifications render `collab_invite`/`collab_accept`.
- **Frontend blocker:** `PostModal.tsx` has the collaborator toggle hard-disabled (`disabled`, `title="Invite collaborator (coming soon)"`) and the invite panel is gated behind `{false && showCollabInvite && ...}` — it can never open.
- **Impact:** Users cannot invite collaborators even though every layer beneath the button works. Classic "feature gated by missing UI piece".
- **Fix:** Enable the toggle + panel in PostModal (see Implementation).

### 🟠 P2 — Collections: full backend, zero frontend
- **Backend:** `POST/GET /api/collections`, `GET /:collectionId`, `POST /:collectionId/posts/:postId`, `DELETE ...`, `DELETE /:collectionId` all implemented with privacy checks (close-friends posts protected).
- **Frontend:** Zero usage of `/api/collections` anywhere in `src/`. Profile tab list = Posts/Saved/Reposts/Drafts only.
- **Impact:** Feature exists on the server but is invisible to users.
- **Fix:** Add a Collections tab to the profile + "Save to collection" flow (see Implementation).

### 🟠 P3 — Landing page "Coming Soon" card is stale/misleading
- The logged-out landing lists **Communities** under "Coming Soon" — but Communities is fully built and live. Marketplace is also listed (not built — that one is genuinely upcoming).
- **Impact:** New users are told a shipped feature doesn't exist.
- **Fix:** Remove Communities from the Coming Soon card; keep Marketplace.

### 🟡 P4 — Archive: backend-only
- `POST /:postId/archive`, `POST /:postId/unarchive`, `GET /archived` all wired in `post.routes.ts`, controller complete — but no UI calls them.
- **Impact:** Users can't archive own posts.
- **Fix (recommended):** Add "Archive post" to the own-post three-dot menu + an "Archived" entry in profile drafts area. (Not implemented this pass — noted for next.)

### ⚫ P5 — Audio Rooms: dead code
- `audioRoom.controllers.ts`, `audioRoom.routes.ts`, `audioRoom.model.ts` exist but are **not mounted** in `server.ts` and no UI references them (the old `AudioRooms.tsx` was deleted).
- **Impact:** None at runtime (unreachable), but it's confusing dead weight.
- **Fix:** Delete the three files (or leave as roadmap stub — recommended: delete).

### ⚪ P6 — Minor gaps vs. other social apps (roadmap, not bugs)
- **Post emoji reactions** (multiple reaction types on posts, like FB/IG) — only Like exists on posts; comments/messages already have emoji reactions.
- **Verified/badge checkmarks** — not present.
- **Story highlights (permanent pinned glances)** — glances auto-expire in 24h; no highlights.
- **User bio links / external link field rendering as clickable cards** — bio exists; no clickable link cards.
- **Notification sound settings / per-type in-app sound** — toggles exist for types; no sound preference.
- **Status/presence text (custom status message)** — active-status icons exist; no custom status text.
- **Marketplace** — listed as coming soon; not built (intentional).
- **Post to multiple communities simultaneously** — posts go to main feed only; community posts live in communities.

---

## 3. Dependency Map (what depends on what)

| Feature | Depends on | Status |
| --- | --- | --- |
| Collab invite | Post creation with `collaborator` field | ✅ Backend chain complete — **UI toggle was the only gap** |
| Collab accept | `collab-accept` route + notification | ✅ Complete |
| Collections | Collection CRUD API | ✅ API complete — UI missing |
| Archive | Archive routes | ✅ Routes complete — UI missing |
| Glance reply → DM | Conversation create on reply | ✅ Complete |
| CF posts/glances | Close-friends membership checks | ✅ Complete |
| Scheduled posts → feed | Cron auto-publish | ✅ Complete |
| Pinned messages | Pin/unpin + panel | ✅ Complete |
| Offline viewing | Dexie + cache + SW | ✅ Complete |

**Conclusion:** No feature is blocked by a missing *backend* dependency. The only blocking gaps are missing *frontend wiring* (Collaboration, Collections) and stale marketing copy (Coming Soon).

---

## 4. Coverage vs. Standard Social Apps

| Capability | Instagram | X/Twitter | Facebook | **Orbit** |
| --- | --- | --- | --- | --- |
| Posts w/ media | ✅ | ✅ | ✅ | ✅ |
| Stories | ✅ | — | ✅ | ✅ (Glances) |
| Stories replies | ✅ | — | ✅ | ✅ |
| DM chat | ✅ | ✅ | ✅ | ✅ |
| Voice notes | ✅ | ✅ | ✅ | ✅ |
| Group chat | ✅ | ✅ | ✅ | ✅ (Communities) |
| Audio/video calls | ✅ | ✅ | ✅ | ✅ |
| Reactions | ❤️ only | ❤️ only | 6 reactions | ❤️ + emoji (comments/messages) |
| Polls | — | ✅ | ✅ | ✅ |
| Reposts/quotes | — | ✅ | ✅ | ✅ |
| Scheduling/drafts | — | ✅ | — | ✅ |
| Communities/groups | — | — | ✅ | ✅ |
| Close friends | ✅ | — | ✅ | ✅ |
| Block/mute | ✅ | ✅ | ✅ | ✅ |
| Private accounts | ✅ | — | ✅ | ✅ |
| Pinned posts | ✅ | ✅ | ✅ | ✅ |
| Save/bookmark | ✅ | ✅ | ✅ | ✅ |
| **Collections (save-to-folder)** | ✅ | ❌ | ✅ | ⚠️ backend-only |
| **Collaboration (co-author)** | ✅ | ❌ | ❌ | ⚠️ backend-only |
| Archive | ✅ | ❌ | ✅ | ⚠️ backend-only |
| Search | ✅ | ✅ | ✅ | ✅ |
| Trending | ✅ | ✅ | ✅ | ✅ |
| Hashtags | ✅ | ✅ | ✅ | ✅ |
| Mentions | ✅ | ✅ | ✅ | ✅ |
| Gamification | ❌ | ❌ | ❌ | ✅ (XP/streaks/missions) |
| Invite system | ❌ | ❌ | ❌ | ✅ |
| Offline mode | ❌ | ❌ | ❌ | ✅ |
| Push notifications | ✅ | ✅ | ✅ | ✅ |
| Translation | ✅ | ✅ | ✅ | ✅ |
| Admin/moderation | ✅ | ✅ | ✅ | ✅ |

**Orbit is feature-complete vs. mainstream social apps** — it actually exceeds them (gamification, invites, offline, co-authoring) once the two backend-only features (Collections, Collaboration) are exposed in the UI.

---

## 5. Verification Evidence

- Browser walkthroughs (Chromium mobile 390×844): all 9 screens render clean, zero console errors (excluding expected pre-login 401), zero layout shift (Δ0).
- S21 polish QA: 9/9 PASS.
- S19 invite QA: API 10/10, browser 10/10.
- S20 offline QA: 6/6 PASS.
- Jest: 9 suites / 71 tests pass.
- Typechecks: client clean, server clean.

---

## 6. Implementation Status (this pass)

| Fix | Status | Verified by |
| --- | --- | --- |
| **P1 Collaboration enabled** — PostModal toggle now opens the invite panel (`showCollabInvite`), panel feeds `collabUsername` into create-post formData (backend resolves @username, sends `collab_invite` notification, feed shows ✦ badge + Accept button). Toggle shows active state + collaborator name in tooltip once a username is set. | ✅ Done | Browser QA: toggle found & enabled, panel opens; client typecheck |
| **P2 Collections UI** — new Profile → Collections tab (self only): create (inline + Enter), collection cards with post counts, open → post list, remove post, delete collection; skeleton + empty states; tab badge count. Feed ShareMenu gains "Save to collection" → picker modal (choose existing or create-new-and-add). Cache eviction after every mutation; picker list refreshes in place. | ✅ Done | Browser QA: tab opens, empty state, create → card appears; zero page errors; client typecheck |
| **P3 Landing Coming Soon card** — Communities (already shipped) replaced with "Post Reactions" teaser; `Users` import removed, `Heart` added. | ✅ Done | client typecheck |
| **P4 Archive UI** | ⏳ Follow-up — backend routes ready; add "Archive" to own-post menu + archived view next pass |
| **P5 Audio Rooms dead code** | ⏳ Follow-up — delete `audioRoom.*` files (controller/routes/model) next pass |

## 7. Known Follow-ups

- Collection detail view does not yet consume the server's `nextCursor`/`hasMore` pagination — fine ≤20 posts, add load-more when collections grow.
- Collab invite is free-text @username; backend errors (user not found / self-invite) surface as a publish toast. Inline validation hint is a future nicety.
- Delete collection has no confirm dialog (matches quick-dismiss pattern); could adopt ConfirmDialog for parity with draft deletion.
- Post emoji reactions (P6) — the landing teaser promises them; implementing full multi-reaction on posts (mirroring the comment/message reaction system) is the top roadmap item.
- Story highlights / verified badges / custom status text / marketplace — tracked roadmap items, not regressions.

---

*This document is a living audit. Every ⚠️ item now has either a shipped fix (Section 6) or a tracked follow-up (Section 7).*

---

# Completion Pass 2 (08-08) — Archive UI, dead-code cleanup, review fixes

## Fixed this pass

1. **Archive UI shipped** (was: full backend, zero frontend).
   - Own-post three-dot menu (Profile → Posts) now has **Archive**.
   - Drafts tab gained a **Drafts / Archived** sub-toggle.
   - Archived sub-view: fetches `GET /api/posts/archived`, shows skeleton + empty state, and each archived card has a **Restore** button (`POST /api/posts/:postId/unarchive`).
   - Restore puts the post straight back into the Posts tab (optimistic) — no refresh needed.
   - Browser-verified end-to-end (seed → render → restore → empty state, zero page errors).

2. **Audio Rooms dead code removed** — source files were already gone; stale `server/dist` artifacts cleaned. Nothing mounted or referenced.

3. **Collections detail pagination** — Load more button appends via cursor; cursor/hasMore reset on every collection open; load-more dedupes by post id.

4. **Delete-collection confirm dialog** — matches the drafts delete pattern (no instant delete).

5. **Code-review fixes**: corrected the cache-eviction key for archive endpoints (`/api/posts/archived`, was a no-op `/api/users/archived-posts`), removed the guaranteed-wrong "Untitled post" heading on archived cards (posts have no `title` field), fixed the restored-post `status` value to `"published"`.

## Validation

- Client typecheck: clean
- Server typecheck: clean
- Jest: 9 suites / 71 tests passed
- Vitest: 9 files / 37 tests passed
- Puppeteer browser QA: archive flow + collections flow, zero page errors
